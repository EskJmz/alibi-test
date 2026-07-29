const CONTENT = {

  // ══════════════════════════════════════════════════
  // ALIBI A — Soirée anniversaire chez Marco
  // ══════════════════════════════════════════════════
  A: {
    alibi: `Le soir du 14 mars, vous étiez chez votre ami Marco Ferretti pour fêter ses 28 ans. Vous vous êtes retrouvés devant chez lui à 19h30 — vous aviez fait un détour par la supérette Franprix du coin pour acheter deux paquets de chips (nature et paprika) et une bouteille de limonade. Son appartement se trouve au 3ème étage du 12 rue des Lilas, dans le 11ème arrondissement. La soirée a commencé par un apéro dans le salon, assis sur le canapé gris qu'il venait d'acheter. À 20h45, vous avez allumé la télé pour regarder le match Marseille contre Lyon en Ligue 1 — Marseille a gagné 2-1, le second but était un penalty à la 78ème minute. Vers 21h15, vous avez commandé des pizzas sur l'application Deliveroo : une margherita pour vous, une quatre-fromages pour Marco et une végétarienne pour son colocataire Théo qui vous a rejoints en cours de soirée. Les pizzas sont arrivées à 21h50. Vous avez terminé la soirée en regardant un épisode d'une série policière dont vous ne vous souvenez plus exactement du titre. Vous avez quitté l'appartement à minuit passé, et êtes rentré directement chez vous à pied — vous habitez à dix minutes à peine.`,
    questions: [
      // Questions directes (réponse dans l'alibi)
      "Chez qui étiez-vous ce soir-là et pour quelle occasion ?",
      "Qu'avez-vous acheté à la supérette avant de monter ?",
      "Quel match avez-vous regardé et quel était le score ?",
      "Qui vous a rejoints en cours de soirée et comment s'appelle-t-il ?",
      "Sur quelle application avez-vous commandé les pizzas ?",
      // Questions piège (réponse non dans l'alibi — improvisation cohérente requise)
      "Comment étiez-vous habillé ce soir-là ?",
      "Il faisait quel temps quand vous êtes parti de chez vous ?",
      "Vous avez mis combien de temps pour aller chez Marco depuis chez vous ?",
      "Qu'est-ce que vous avez offert à Marco pour son anniversaire ?",
      "Comment s'appelait la série policière que vous avez regardée à la fin ?",
      "Est-ce que Marco avait invité d'autres personnes que vous ce soir-là ?",
      "Vous avez bu quoi pendant l'apéro en dehors de la limonade ?"
    ]
  },

  // ══════════════════════════════════════════════════
  // ALIBI B — Cinéma avec la cousine Léa
  // ══════════════════════════════════════════════════
  B: {
    alibi: `Le soir du 14 mars, vous étiez au cinéma Pathé Opéra, situé au 2 boulevard des Italiens dans le 9ème arrondissement, avec votre cousine Léa Marchand. Vous vous êtes retrouvés devant l'entrée à 19h45. Léa avait réservé deux places en ligne la veille sur l'application MyCanal — vous les avez récupérées ensemble à la borne automatique à droite de l'entrée, en utilisant le code de réservation qu'elle avait reçu par mail. Avant la séance, vous avez dîné dans le restaurant vietnamien "Pho 9" juste en face du cinéma : un grand bol de pho bœuf pour vous avec des piments verts à part, et une assiette de rouleaux de printemps aux crevettes pour Léa accompagnée d'une sauce nuoc-mâm. Le repas a duré environ 45 minutes. Vous êtes entrés dans la salle à 20h05 pour une séance de 20h15. Le film s'appelait "L'Ombre du Faucon", un thriller français avec un acteur aux cheveux gris dont vous ne connaissez pas le nom. La salle était à moitié pleine, vous étiez placés au milieu du rang G. Le film a duré environ deux heures et quart. À la sortie, vers 22h45, vous avez pris le métro ligne 9 direction Mairie de Montreuil depuis la station Grands Boulevards pour rentrer chacun chez vous. Vous n'avez croisé personne de connaissance de toute la soirée.`,
    questions: [
      // Questions directes
      "Avec qui étiez-vous et où exactement ?",
      "Comment avez-vous récupéré vos billets ?",
      "Où avez-vous dîné avant la séance et qu'avez-vous commandé ?",
      "Comment s'appelait le film et de quel genre s'agissait-il ?",
      "À quelle station de métro avez-vous pris le métro pour rentrer ?",
      // Questions piège
      "De quoi parlait le film en gros ?",
      "Vous avez pris quelque chose à grignoter au cinéma ?",
      "Comment vous avez trouvé le film — vous avez aimé ?",
      "Comment vous êtes-vous retrouvés avec Léa, vous vous êtes rejoints quelque part avant ?",
      "Il y avait beaucoup de monde dans le restaurant avant la séance ?",
      "Léa, c'est la fille de quel côté de votre famille ?",
      "Vous avez fait quoi une fois rentré chez vous ce soir-là ?"
    ]
  },

  // ══════════════════════════════════════════════════
  // ALIBI C — Week-end en dehors de Paris
  // ══════════════════════════════════════════════════
  C: {
    alibi: `Le week-end du 14 et 15 mars, vous étiez à Lyon pour rendre visite à votre ancienne colocataire Sarah Benali qui s'y est installée il y a deux ans. Vous avez pris le TGV de Paris-Gare de Lyon à 8h12 le samedi matin, arrivée à Lyon Part-Dieu à 10h02. Sarah vous attendait sur le quai. Vous avez déposé votre sac chez elle — elle habite dans le quartier de la Croix-Rousse, rue Pelletier, au 2ème étage d'un immeuble en pierre. L'après-midi, vous avez visité le Vieux-Lyon ensemble, vous avez mangé des quenelles dans un bouchon typique appelé "Chez Sylvain", rue de la Martinière. Le soir, vous avez cuisiné chez elle — une ratatouille — et regardé un film sur Netflix. Le dimanche matin, vous avez pris un brunch au café du coin, puis vous avez repris le TGV à 17h45 pour rentrer à Paris, arrivée à 19h35.`,
    questions: [
      // Questions directes
      "Où étiez-vous ce week-end-là et chez qui ?",
      "Quel train avez-vous pris pour aller à Lyon et à quelle heure ?",
      "Dans quel quartier de Lyon habite Sarah ?",
      "Où avez-vous mangé le samedi midi et qu'avez-vous commandé ?",
      "À quelle heure avez-vous repris le train pour rentrer à Paris ?",
      // Questions piège
      "Comment vous connaissez Sarah exactement, vous avez été colocataires où et quand ?",
      "Vous avez dormi dans quelle pièce chez elle ?",
      "C'était quoi le film que vous avez regardé le samedi soir ?",
      "Il faisait quel temps à Lyon ce week-end ?",
      "Vous avez visité autre chose que le Vieux-Lyon ?",
      "Vous aviez un billet aller-retour ou vous avez pris séparément ?",
      "Vous avez ramené quelque chose de Lyon en rentrant ?"
    ]
  },

  // ══════════════════════════════════════════════════
  // ALIBI D — Soirée concert
  // ══════════════════════════════════════════════════
  D: {
    alibi: `Le soir du 14 mars, vous étiez à un concert à la Salle Pleyel, dans le 8ème arrondissement de Paris. Vous y alliez avec votre collègue Romain Vidal — c'était lui qui avait les billets, des places en catégorie 2 au balcon gauche, rangée C. Le groupe qui jouait s'appelait "November Rain", un groupe de rock alternatif britannique en tournée européenne. Vous vous êtes retrouvés devant la salle à 20h15, le concert commençait à 21h. Pendant l'attente vous avez bu une bière au bar du hall d'entrée. Le concert a duré environ deux heures avec un rappel de trois chansons. À la sortie, vers 23h30, vous avez partagé un taxi avec Romain jusqu'à la station Châtelet où vous vous êtes séparés — lui prenait la ligne 4, vous la ligne 1. Vous étiez rentré chez vous peu après minuit.`,
    questions: [
      // Questions directes
      "Où étiez-vous ce soir-là et avec qui ?",
      "Comment s'appelait le groupe qui jouait ?",
      "À quelle heure vous êtes-vous retrouvés devant la salle ?",
      "Où étiez-vous placés dans la salle ?",
      "Comment êtes-vous rentrés à la fin du concert ?",
      // Questions piège
      "C'est quoi le style de musique de ce groupe exactement ?",
      "Vous pouvez citer une chanson qu'ils ont jouée ce soir-là ?",
      "Comment vous vous êtes retrouvés avec Romain pour ce concert, c'est lui qui vous a invité ?",
      "Il y avait combien de personnes dans la salle à votre avis ?",
      "Vous avez acheté quelque chose au merchandising ?",
      "Vous parliez de quoi avec Romain dans le taxi en rentrant ?",
      "C'était votre premier concert à la Salle Pleyel ?"
    ]
  },

  // ══════════════════════════════════════════════════
  // ALIBI E — Journée shopping et musée
  // ══════════════════════════════════════════════════
  E: {
    alibi: `Le 14 mars, vous avez passé la journée avec votre amie Camille Russo. Vous vous êtes retrouvés à 11h devant le musée d'Orsay — Camille avait réservé deux billets sur le site du musée pour éviter la queue. Vous avez passé environ deux heures à l'intérieur, vous avez particulièrement aimé la salle des impressionnistes au 5ème étage. À 13h30 vous avez déjeuné dans la brasserie du musée : une formule entrée-plat, vous avez pris une salade niçoise puis un saumon grillé, Camille a pris une soupe et un steak-frites. L'addition était d'environ 55 euros au total, vous avez partagé. L'après-midi vous avez fait du shopping rue de Rivoli — Camille cherchait des chaussures et vous avez trouvé une veste dans une boutique dont vous ne vous souvenez plus du nom, payée autour de 80 euros. Vous vous êtes séparés vers 18h30 devant la station de métro Tuileries.`,
    questions: [
      // Questions directes
      "Où avez-vous passé la matinée et avec qui ?",
      "Comment avez-vous eu vos billets pour le musée ?",
      "Qu'avez-vous mangé à la brasserie du musée ?",
      "Qu'avez-vous acheté l'après-midi et à quel prix environ ?",
      "À quelle heure et où vous êtes-vous séparés ?",
      // Questions piège
      "Vous avez vu quelle œuvre en particulier au musée qui vous a marqué ?",
      "Camille, vous la connaissez depuis combien de temps ?",
      "Vous avez pris quoi comme transport pour aller au musée d'Orsay le matin ?",
      "Il faisait beau ce jour-là, vous avez marché un peu le long de la Seine ?",
      "Vous avez trouvé les chaussures que Camille cherchait ?",
      "Vous avez fait autre chose que la rue de Rivoli pour le shopping ?",
      "Qu'est-ce que vous avez fait en rentrant chez vous le soir ?"
    ]
  }
};

module.exports = CONTENT;
