const express = require('express');
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-secret-key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

let data = {
  bustl: { sales: 0, orders: 0, aov: 0, lastWeek: 0, updatedAt: null },
  shopify: { sales: 0, orders: 0, refunds: 0, updatedAt: null },
  xero: { bank: 0, expenses: 0, invoices: [], updatedAt: null },
  ipayroll: { labour: 0, periodWages: 0, periodDays: 14, periodElapsed: 0, updatedAt: null },
  lastSync: null
};

const SECRET = process.env.SECRET_KEY || 'piccolomorso2026';

app.post('/webhook/xero', (req, res) => {
  const key = req.headers['x-secret-key'] || req.body.secretKey;
  if (key !== SECRET) return res.status(403).json({ error: 'Unauthorized' });
  const b = req.body;
  if (b.bank !== undefined) data.xero.bank = parseFloat(b.bank) || 0;
  if (b.expenses !== undefined) data.xero.expenses = parseFloat(b.expenses) || 0;
  if (b.invoiceId || b.invoiceNumber) {
    const inv = {
      id: b.invoiceId || b.invoiceNumber,
      desc: b.contactName || b.description || 'Xero Invoice',
      amount: parseFloat(b.amountDue || b.total) || 0,
      due: b.dueDate || b.dueDateString || new Date().toISOString().split('T')[0],
      source: 'Xero'
    };
    const idx = data.xero.invoices.findIndex(i => i.id === inv.id);
    if (idx >= 0) data.xero.invoices[idx] = inv;
    else data.xero.invoices.push(inv);
  }
  data.xero.updatedAt = new Date().toISOString();
  data.lastSync = new Date().toISOString();
  res.json({ success: true });
});

app.post('/webhook/shopify', (req, res) => {
  const key = req.headers['x-secret-key'] || req.body.secretKey;
  if (key !== SECRET) return res.status(403).json({ error: 'Unauthorized' });
  const b = req.body;
  if (b.dailySales !== undefined) {
    data.shopify.sales = parseFloat(b.dailySales) || 0;
    data.shopify.orders = parseInt(b.dailyOrders) || 0;
  } else if (b.totalPrice || b.total_price) {
    const today = new Date().toDateString();
    if (data.shopify._lastReset !== today) {
      data.shopify.sales = 0;
      data.shopify.orders = 0;
      data.shopify._lastReset = today;
    }
    data.shopify.sales += parseFloat(b.totalPrice || b.total_price) || 0;
    data.shopify.orders += 1;
  }
  if (b.refunds !== undefined) data.shopify.refunds = parseFloat(b.refunds) || 0;
  data.shopify.updatedAt = new Date().toISOString();
  data.lastSync = new Date().toISOString();
  res.json({ success: true, sales: data.shopify.sales, orders: data.shopify.orders });
});

app.post('/webhook/ipayroll', (req, res) => {
  const key = req.headers['x-secret-key'] || req.body.secretKey;
  if (key !== SECRET) return res.status(403).json({ error: 'Unauthorized' });
  const b = req.body;
  if (b.labour !== undefined) data.ipayroll.labour = parseFloat(b.labour) || 0;
  if (b.periodWages !== undefined) data.ipayroll.periodWages = parseFloat(b.periodWages) || 0;
  if (b.periodDays !== undefined) data.ipayroll.periodDays = parseInt(b.periodDays) || 14;
  if (b.periodElapsed !== undefined) data.ipayroll.periodElapsed = parseInt(b.periodElapsed) || 0;
  data.ipayroll.updatedAt = new Date().toISOString();
  data.lastSync = new Date().toISOString();
  res.json({ success: true, labour: data.ipayroll.labour });
});

app.post('/webhook/bustl', (req, res) => {
  const key = req.headers['x-secret-key'] || req.body.secretKey;
  if (key !== SECRET) return res.status(403).json({ error: 'Unauthorized' });
  const b = req.body;
  if (b.sales !== undefined) data.bustl.sales = parseFloat(b.sales) || 0;
  if (b.orders !== undefined) data.bustl.orders = parseInt(b.orders) || 0;
  if (b.aov !== undefined) data.bustl.aov = parseFloat(b.aov) || 0;
  if (b.lastWeek !== undefined) data.bustl.lastWeek = parseFloat(b.lastWeek) || 0;
  data.bustl.updatedAt = new Date().toISOString();
  data.lastSync = new Date().toISOString();
  res.json({ success: true, sales: data.bustl.sales });
});

app.get('/data', (req, res) => {
  const key = req.query.key || req.headers['x-secret-key'];
  if (key !== SECRET) return res.status(403).json({ error: 'Unauthorized' });
  res.json({ ...data, serverTime: new Date().toISOString(), status: 'live' });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Piccolo Morso Backend',
    status: 'running',
    lastSync: data.lastSync,
    webhooks: ['/webhook/xero', '/webhook/shopify', '/webhook/ipayroll', '/webhook/bustl'],
    data: '/data?key=YOUR_SECRET'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Piccolo Morso backend running on port ${PORT}`));
