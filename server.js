const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const database = require("./src/config/database");
const authRoutes = require("./src/routes/auth.routes");
const walletRoutes = require("./src/routes/wallet.routes");

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

const appVersion = "v1/api";

// Rotas
app.use(`/${appVersion}/auth`, authRoutes);
app.use(`/${appVersion}/wallet`, walletRoutes);

const startServer = async () => {
  try {
    // Testa a conexão com o banco de dados
    const isConnected = await database.connect();
    
    if (!isConnected) {
      console.error('❌ Não foi possível iniciar o servidor devido a falha na conexão com o banco de dados');
      process.exit(1);
    }

    app.listen(7777, () => {
      console.log("🌱 API está rodando na porta 7777");
    });

    // Configura o encerramento gracioso do servidor
    process.on('SIGTERM', async () => {
      console.log('🛑 Encerrando o servidor...');
      await database.disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Erro ao iniciar o servidor:', error);
    process.exit(1);
  }
};

app.get("/", (req, res) => {
  res.send("🌱 API está rodando");
});

// Inicia o servidor
startServer();


