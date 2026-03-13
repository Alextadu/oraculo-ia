// functions/index.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { MercadoPagoConfig, Preference } = require("mercadopago");
const admin = require("firebase-admin");

admin.initializeApp();

// Define o secret (deve coincidir com o nome que você usou no secrets:set)
const mpAccessToken = defineSecret("MERCADO_PAGO_ACCESS_TOKEN");

const mpClient = new MercadoPagoConfig({
  accessToken: mpAccessToken.value(),  // Acesso seguro via params
});

const preferenceApi = new Preference(mpClient);

exports.createMercadoPagoPreference = onCall(
  {
    region: "southamerica-east1",
    secrets: [mpAccessToken],  // ← Obrigatório para injetar o secret no runtime!
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Usuário não autenticado. Faça login.");
    }

    const { packageId, coins, price } = request.data;

    if (!packageId || !coins || !price || typeof price !== "number") {
      throw new HttpsError("invalid-argument", "Dados incompletos ou inválidos.");
    }

    try {
      const preference = await preferenceApi.create({
        body: {
          items: [
            {
              id: packageId,
              title: `${coins} Moedas - Gerador de Palpites Oraculo`,
              quantity: 1,
              unit_price: price,
              currency_id: "BRL",
            },
          ],
          payer: { email: request.auth.token.email || undefined },
          back_urls: {
            success: "https://SEU-DOMINIO.vercel.app/sucesso",
            failure: "https://SEU-DOMINIO.vercel.app/falha",
            pending: "https://SEU-DOMINIO.vercel.app/pendente",
          },
          notification_url: `https://${process.env.GCP_PROJECT}.cloudfunctions.net/webhookMercadoPago`,
          auto_return: "approved",
          external_reference: request.auth.uid,
        },
      });

      return { success: true, init_point: preference.init_point };
    } catch (error) {
      console.error("Erro criando preferência Mercado Pago:", error.message);
      throw new HttpsError("internal", "Falha ao gerar pagamento. Tente novamente.");
    }
  }
);