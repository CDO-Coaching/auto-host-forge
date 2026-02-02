// Configuration Stripe côté client
// Utilise uniquement la clé publique et les Payment Links (pas de clé secrète côté client)

export const STRIPE_PUBLIC_KEY = "pk_test_51SqDMn4Ea2SMa31kKtg8O43pIREW2EuApnI0FRGC8oCj1FpQ3stKtEdAXZKRSzTzNky85CsiRy5DkaKrGJtT5puM006Ks5lorw";

// Configuration des produits Stripe avec leurs Payment Links
// IMPORTANT: Dans Stripe Dashboard > Payment Links > ton lien > Settings > After payment
// Configurer la redirection vers: https://auto-host-forge.lovable.app/sportif/paiement-succes?price_id=price_xxx&product_id=prod_xxx&product_name=Abonnement%20mensuel
export const STRIPE_PRODUCTS = [
  {
    id: "prod_default",
    name: "Abonnement mensuel",
    priceId: "price_default",
    paymentLink: "https://buy.stripe.com/test_3cI4gsepfbO6bOQalwdIA04",
    amount: 8000, // en centimes
    currency: "eur",
    isRecurring: true,
    interval: "month",
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
