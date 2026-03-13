// functions/index.js - Função callable para criar preferência de pagamento Mercado Pago
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { MercadoPagoConfig, Preference } = require("mercadopago");
const admin = require("firebase-admin");

admin.initializeApp();

// Secret injetado automaticamente (nome exato do firebase functions:secrets:set)
const mpAccessToken = defineSecret("MERCADO_PAGO_ACCESS_TOKEN");

const mpClient = new MercadoPagoConfig({
  accessToken: mpAccessToken.value(),
});

const preferenceApi = new Preference(mpClient);

exports.createMercadoPagoPreference = onCall(
  {
    region: "southamerica-east1", // baixa latência no Brasil
    secrets: [mpAccessToken],     // injeta o secret no runtime
  },
  async (request) => {
    // Segurança: autenticação obrigatória
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Faça login para comprar moedas.");
    }

    const { packageId, coins, price } = request.data;

    // Validação básica
    if (!packageId || !coins || !price || typeof price !== "number" || price <= 0) {
      throw new HttpsError("invalid-argument", "Pacote inválido: packageId, coins e price (número > 0) são obrigatórios.");
    }

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
            success: "https://SEU-DOMINIO.vercel.app/sucesso-pagamento",  // ← troque pelo seu
            failure: "https://SEU-DOMINIO.vercel.app/falha-pagamento",
            pending: "https://SEU-DOMINIO.vercel.app/pendente-pagamento",
          },
          notification_url: `https://${process.env.GCP_PROJECT}.cloudfunctions.net/webhookMercadoPago`,
          auto_return: "approved",
          external_reference: request.auth.uid, // UID para identificar o usuário no webhook
        },
      });

      return { success: true, init_point: preference.init_point };
    } catch (error) {
      console.error("Erro ao criar preferência Mercado Pago:", error);
      throw new HttpsError("internal", "Falha ao gerar o pagamento. Tente novamente mais tarde.");
    }
  }
);