const express = require('express');
const fs = require('fs');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let clients = [];

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
  clients.push(ws);
  ws.on('close', () => {
    clients = clients.filter((client) => client !== ws);
  });
});

function broadcastUpdate() {
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send('update');
    }
  });
}

const databasePath = './database.json';

function readDatabase() {
  if (!fs.existsSync(databasePath)) return {};
  const raw = fs.readFileSync(databasePath);
  return JSON.parse(raw);
}

function writeDatabase(data) {
  fs.writeFileSync(databasePath, JSON.stringify(data, null, 2));
}

app.get('/data', (req, res) => {
  const db = readDatabase();
  res.json(db);
});

app.post('/update', (req, res) => {
  const db = readDatabase();
  const { type } = req.body;

  if (type === 'addModel') {
    const { model } = req.body;
    if (!db[model]) db[model] = {};
  }

  if (type === 'renameModel') {
    const { oldModel, newModel } = req.body;
    if (db[oldModel]) {
      db[newModel] = db[oldModel];
      delete db[oldModel];
    }
  }

  if (type === 'deleteModel') {
    const { model } = req.body;
    delete db[model];
  }

  if (type === 'addRepair') {
    const { model, repair, price } = req.body;
    if (!db[model]) db[model] = {};
    db[model][repair] = price;
  }

  if (type === 'renameRepair') {
    const { model, oldRepair, newRepair } = req.body;
    if (db[model] && db[model][oldRepair] !== undefined) {
      db[model][newRepair] = db[model][oldRepair];
      delete db[model][oldRepair];
    }
  }

  if (type === 'updateRepairPrice') {
    const { model, repair, price } = req.body;
    if (db[model] && db[model][repair] !== undefined) {
      db[model][repair] = price;
    }
  }

  if (type === 'deleteRepair') {
    const { model, repair } = req.body;
    if (db[model] && db[model][repair] !== undefined) {
      delete db[model][repair];
    }
  }

  writeDatabase(db);
  broadcastUpdate();
  res.json({ success: true });
});

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});
