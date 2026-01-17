// Configuration Stripe côté client
// Utilise uniquement la clé publique et les Payment Links (pas de clé secrète côté client)

export const STRIPE_PUBLIC_KEY = "pk_test_51SqDMn4Ea2SMa31kKtg8O43pIREW2EuApnI0FRGC8oCj1FpQ3stKtEdAXZKRSzTzNky85CsiRy5DkaKrGJtT5puM006Ks5lorw";

// Configuration des produits Stripe avec leurs Payment Links
export const STRIPE_PRODUCTS = [
  {
    id: "prod_TnpBWRzXzACMFB",
    name: "Abonnement mensuel",
    priceId: "price_1SqDX44Ea2SMa31k0hkpUthY",
    paymentLink: "https://buy.stripe.com/test_dRmfZa0ypf0i8CEalwdIA02",
    amount: 8000, // en centimes
    currency: "eur",
    isRecurring: true,
    interval: "month",
  },
  {
    id: "prod_TnpCuNWB0wJNRn",
    name: "Abonnement mensuel ancien",
    priceId: "price_1SqDYa4Ea2SMa31k8W3kVXUk",
    paymentLink: "https://buy.stripe.com/test_eVq5kwdlb7xQ8CE51cdIA03",
    amount: 7000, // en centimes
    currency: "eur",
    isRecurring: false,
    interval: null,
  },
];

// Fonction pour obtenir le payment link avec paramètres
export function getPaymentLinkWithParams(
  paymentLink: string,
  options?: {
    prefillEmail?: string;
    clientReferenceId?: string;
    successUrl?: string;
  }
): string {
  const url = new URL(paymentLink);
  
  if (options?.prefillEmail) {
    url.searchParams.set("prefilled_email", options.prefillEmail);
  }
  
  if (options?.clientReferenceId) {
    url.searchParams.set("client_reference_id", options.clientReferenceId);
  }
  
  return url.toString();
}

// Fonction pour obtenir un produit par son price ID
export function getProductByPriceId(priceId: string) {
  return STRIPE_PRODUCTS.find(p => p.priceId === priceId);
}
