// functions/index.js
const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { MercadoPagoConfig, Preference } = require("mercadopago");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

// Registra o secret do Mercado Pago (acesso ao valor só em runtime)
const mpAccessToken = defineSecret("MERCADO_PAGO_ACCESS_TOKEN");

// Função callable: gera o link de pagamento (Checkout Pro)
exports.createMercadoPagoPreference = onCall(
  {
    region: "southamerica-east1",
    secrets: [mpAccessToken],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Faça login para comprar moedas.");
    }

    const { packageId, coins, price } = request.data;

    if (!packageId || !coins || !price || typeof price !== "number" || price <= 0) {
      throw new HttpsError("invalid-argument", "Pacote inválido: packageId, coins e price (número > 0) são obrigatórios.");
    }

    // Acesso ao secret só aqui (runtime)
    const accessToken = mpAccessToken.value();

    if (!accessToken) {
      console.error("Secret MERCADO_PAGO_ACCESS_TOKEN não encontrado ou vazio.");
      throw new HttpsError("internal", "Erro de configuração interna. Contate o suporte.");
    }

    const mpClient = new MercadoPagoConfig({ accessToken });
    const preferenceApi = new Preference(mpClient);

    try {
      const preference = await preferenceApi.create({
        body: {
          items: [
            {
              id: packageId,
              title: `${coins} Moedas - Oraculo IA (Gerador de Palpites)`,
              quantity: 1,
              unit_price: price,
              currency_id: "BRL",
            },
          ],
          payer: {
            email: request.auth.token.email || undefined,
          },
          back_urls: {
            success: "https://oraculo-ia-sable.vercel.app/sucesso-pagamento",
            failure: "https://oraculo-ia-sable.vercel.app/falha-pagamento",
            pending: "https://oraculo-ia-sable.vercel.app/pendente-pagamento",
          },
          notification_url: `https://southamerica-east1-oraculo-4f853.cloudfunctions.net/webhookMercadoPago`,
          auto_return: "approved",
          external_reference: request.auth.uid, // UID para identificar o usuário no webhook
        },
      });

      return { success: true, init_point: preference.init_point };
    } catch (error) {
      console.error("Erro ao criar preferência Mercado Pago:", error.message || error);
      throw new HttpsError("internal", "Falha ao gerar o pagamento. Tente novamente.");
    }
  }
);

// Função webhook: recebe notificações do Mercado Pago e credita moedas
exports.webhookMercadoPago = onRequest(
  {
    region: "southamerica-east1",
    secrets: [mpAccessToken],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Método não permitido");
      return;
    }

    const signatureHeader = req.headers["x-signature"];
    const requestId = req.headers["x-request-id"];

    if (!signatureHeader) {
      console.warn("Webhook sem x-signature");
      res.status(400).send("Assinatura ausente");
      return;
    }

    const payload = JSON.stringify(req.body);
    const secret = mpAccessToken.value();

    // Cálculo HMAC-SHA256
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");

    // Mercado Pago envia no formato "v1=abc123" ou direto
    const receivedSignature = signatureHeader.includes("=") 
      ? signatureHeader.split("=")[1] 
      : signatureHeader;

    if (receivedSignature !== expectedSignature) {
      console.error("Assinatura inválida no webhook", { requestId });
      res.status(401).send("Assinatura inválida");
      return;
    }

    const paymentId = req.body?.data?.id;

    if (!paymentId) {
      console.warn("Webhook sem payment ID");
      res.status(200).send("OK");
      return;
    }

    try {
      const mpClient = new MercadoPagoConfig({ accessToken: secret });
      const payment = await new Preference(mpClient).get({ id: paymentId });

      if (payment.status === "approved") {
        const uid = payment.external_reference;
        // Valor fixo por enquanto - depois podemos extrair do título ou metadata
        const coinsAmount = 100; // Ajuste conforme o pacote comprado

        if (!uid) {
          console.error("Webhook sem external_reference (UID)");
          res.status(200).send("OK");
          return;
        }

        await admin.firestore()
          .collection("users")
          .doc(uid)
          .update({
            coins: admin.firestore.FieldValue.increment(coinsAmount),
            lastPurchaseDate: admin.firestore.Timestamp.now(),
            lastPurchaseAmount: coinsAmount,
          });

        console.log(`Moedas creditadas: ${coinsAmount} para UID ${uid} (pagamento ${paymentId})`);
      } else {
        console.log(`Pagamento ${paymentId} status: ${payment.status} - sem crédito`);
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("Erro no webhook Mercado Pago:", error.message);
      res.status(200).send("OK"); // Sempre 200 para Mercado Pago não reenviar
    }
  }
);