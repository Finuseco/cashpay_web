/**
 * Référentiel des codes de motif de litige Visa (Reason Codes)
 * Basé sur la documentation officielle Marqeta.
 */
export const VISA_DISPUTE_REASONS = [
  {
    category: "Fraude",
    codes: [
      { code: "10.1", label: "Émission/Transfert non autorisé (EMV)" },
      { code: "10.2", label: "Fraude sur carte non présente (e-commerce)" },
      { code: "10.3", label: "Autre fraude (Transaction non autorisée)" },
      { code: "10.4", label: "Transaction frauduleuse - Absence de signature/PIN" },
      { code: "10.5", label: "Fraude Visa Checkout" }
    ]
  },
  {
    category: "Autorisation",
    codes: [
      { code: "11.1", label: "Code d'autorisation non obtenu" },
      { code: "11.2", label: "Code d'autorisation décliné" },
      { code: "11.3", label: "Problème de date/heure d'autorisation" }
    ]
  },
  {
    category: "Erreurs de Traitement",
    codes: [
      { code: "12.1", label: "Numéro de compte erroné" },
      { code: "12.2", label: "Traitement de transaction en double" },
      { code: "12.3", label: "Montant de transaction incorrect" },
      { code: "12.4", label: "Devise incorrecte" },
      { code: "12.5", label: "Crédit non traité (Remboursement manquant)" },
      { code: "12.6", label: "Transaction tardive" },
      { code: "12.7", label: "Erreur de paiement multiple" }
    ]
  },
  {
    category: "Litiges Consommation",
    codes: [
      { code: "13.1", label: "Marchandise/Services non reçus" },
      { code: "13.2", label: "Annulation ou retour de marchandise" },
      { code: "13.3", label: "Marchandise défectueuse ou non conforme" },
      { code: "13.4", label: "Erreur de facturation récurrente" },
      { code: "13.5", label: "Fausse représentation / Fraude commerciale" },
      { code: "13.6", label: "Crédit non conforme à la politique d'annulation" },
      { code: "13.7", label: "Paiement effectué par d'autres moyens" },
      { code: "13.8", label: "Billet/Voucher non honoré" },
      { code: "13.9", label: "Retrait GAB non reçu ou partiel" }
    ]
  }
];
