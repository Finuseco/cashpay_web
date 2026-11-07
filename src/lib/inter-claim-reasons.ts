export const INTER_REJECTION_REASONS = {
 identity_mismatch:{label:'Identité non concordante',guidance:'Le bénéficiaire du transfert doit correspondre au nom complet de votre compte et de votre pièce. Corrigez les données avant de soumettre une nouvelle demande.'},
 invalid_identity:{label:'Pièce invalide ou non vérifiable',guidance:'Veuillez mettre à jour une pièce lisible, valide et vous appartenant, ainsi que votre signature. Ne soumettez pas les documents d’un tiers.'},
 invalid_tracking:{label:'Référence de transfert invalide',guidance:'Vérifiez la référence exacte auprès de l’expéditeur. Ne soumettez pas un transfert dont vous n’êtes pas le bénéficiaire.'},
 currency_unavailable:{label:'Devise non prise en charge ou indisponible',guidance:'Vérifiez les devises proposées et contactez le support avant une nouvelle demande.'}
} as const;
