// functions/index.js - Função callable para criar preferência de pagamento Mercado Pago
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { MercadoPagoConfig, Preference } = require("mercadopago");
const admin = require("firebase-admin");

admin.initializeApp();

// Registra o secret necessário (não acessa valor aqui!)
const mpAccessToken = defineSecret("MERCADO_PAGO_ACCESS_TOKEN");

exports.createMercadoPagoPreference = onCall(
  {
    region: "southamerica-east1", // São Paulo - baixa latência no RJ
    secrets: [mpAccessToken],     // Registra que essa função precisa desse secret
  },
  async (request) => {
    // Segurança: autenticação obrigatória (Firebase Auth)
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Faça login para comprar moedas.");
    }

    const { packageId, coins, price } = request.data;

    // Validação robusta
    if (!packageId || !coins || !price || typeof price !== "number" || price <= 0) {
      throw new HttpsError("invalid-argument", "Pacote inválido: packageId, coins e price (número > 0) são obrigatórios.");
    }

    // Acesso ao secret SÓ AQUI (runtime da função)
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
            success: "https://SEU-DOMINIO.vercel.app/sucesso-pagamento",  // ← troque pelo seu domínio real no Vercel
            failure: "https://SEU-DOMINIO.vercel.app/falha-pagamento",
            pending: "https://SEU-DOMINIO.vercel.app/pendente-pagamento",
          },
          notification_url: `https://${process.env.GCP_PROJECT}.cloudfunctions.net/webhookMercadoPago`,
          auto_return: "approved",
          external_reference: request.auth.uid, // UID do usuário para webhook creditar moedas
        },
      });

      return { success: true, init_point: preference.init_point };
    } catch (error) {
      console.error("Erro ao criar preferência Mercado Pago:", error.message || error);
      throw new HttpsError("internal", "Falha ao gerar o pagamento. Tente novamente.");
    }
  }
);