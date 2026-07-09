/**
 * Gestionnaire de commandes fun
 * Commandes divertissantes et interactives
 */

class FunManager {
  constructor() {
    this.jokes = [
      "Pourquoi les programmeurs préfèrent-ils le mode sombre ? Parce que la lumière attire les bugs.",
      "Combien de programmeurs faut-il pour changer une ampoule ? Aucun, c'est un problème matériel.",
      "Pourquoi les programmeurs ne jouent-ils jamais à cache-cache ? Parce que les bonnes se cachent.",
      "Comment appelle-t-on un programmeur qui a peur de l'eau ? Un code-aquaphobe.",
      "Pourquoi les programmeurs détestent-ils la nature ? Trop de bugs.",
      "Quel est le jeu préféré des développeurs ? Cache-cache de bugs.",
      "Pourquoi les programmeurs préfèrent-ils les chats ? Parce qu'ils ont 9 vies, comme les serveurs.",
      "Comment un programmeur répare-t-il une fuite ? Il met un patch.",
      "Pourquoi les programmeurs ne font-ils pas de blagues de saison ? Parce que c'est un problème temporel.",
      "Que dit un programmeur quand il voit une fille ? 'J'ai trouvé un bug.'"
    ];

    this.facts = [
      "Le premier ordinateur électronique, ENIAC, pesait 27 tonnes.",
      "Le premier virus informatique a été créé en 1983.",
      "Le premier site web est toujours en ligne : http://info.cern.ch",
      "Le mot 'robot' vient du tchèque 'robota' qui signifie 'travail forcé'.",
      "Le premier email a été envoyé en 1971.",
      "Le symbole @ dans les emails s'appelle 'arobase' en français.",
      "Le premier jeu vidéo a été créé en 1958.",
      "Le premier smartphone a été lancé par IBM en 1994.",
      "Le premier disque dur pesait une tonne et pouvait stocker 5 Mo.",
      "Le mot 'ordinateur' a été inventé par IBM France en 1955."
    ];

    this.quotes = [
      "La technologie n'est rien. Ce qui compte, c'est que vous ayez foi en l'humanité, que les gens soient fondamentalement bons et intelligents, et si vous leur donnez des outils, ils feront des choses merveilleuses avec eux. - Steve Jobs",
      "N'importe quel progrès technologique suffisamment avancé est indiscernable de la magie. - Arthur C. Clarke",
      "Le meilleur moyen de prédire l'avenir, c'est de l'inventer. - Alan Kay",
      "Le logiciel est un gaspillage; créons-en davantage. - Dave Thomas",
      "La meilleure façon de corriger des erreurs est de les corriger le plus tôt possible. - Linus Torvalds",
      "Le code est comme l'humour. Quand il faut l'expliquer, c'est mauvais. - Cory House",
      "L'optimisation prématurée est la racine de tous les maux. - Donald Knuth",
      "Les bons programmeurs s'inquiètent des structures de données et de leurs relations. - Linus Torvalds",
      "Le test ne peut pas prouver l'absence de bugs, seulement leur présence. - Edsger Dijkstra",
      "Mesurer la productivité d'un programmeur par ses lignes de code, c'est comme mesurer la construction d'un avion par son poids. - Bill Gates"
    ];

    this.coinSides = ['Pile', 'Face'];
    this.rpsChoices = ['pierre', 'papier', 'ciseaux'];
    
    // Dictionnaire de mèmes (description -> image URL)
    this.memes = {
      'programmer': 'https://i.imgflip.com/1bij.jpg',
      'debugging': 'https://i.imgflip.com/1bgw.jpg',
      'coding': 'https://i.imgflip.com/30b1gx.jpg',
      'server': 'https://i.imgflip.com/1otk96.jpg',
      'internet': 'https://i.imgflip.com/1h7in3.jpg'
    };
  }

  /**
   * Commande: !8ball
   */
  async eightball(message, args) {
    const question = args.join(' ');
    if (!question) {
      return message.reply('❌ Pose une question.');
    }

    const responses = [
      'Oui, certainement.',
      'C\'est décidément le cas.',
      'Sans aucun doute.',
      'Absolument.',
      'Tu peux compter dessus.',
      'Comme je le vois, oui.',
      'Très probablement.',
      'Les perspectives sont bonnes.',
      'Oui.',
      'Les signes indiquent que oui.',
      'Réponse vague, essaie encore.',
      'Demande plus tard.',
      'Mieux vaut ne pas te le dire maintenant.',
      'Je ne peux pas prédire maintenant.',
      'Concentre-toi et demande à nouveau.',
      'Ne compte pas dessus.',
      'Ma réponse est non.',
      'Mes sources disent non.',
      'Les perspectives ne sont pas bonnes.',
      'Très douteux.'
    ];

    const response = responses[Math.floor(Math.random() * responses.length)];
    const embed = {
      color: 0x5865f2,
      title: '🎱 Boule magique 8',
      fields: [
        { name: 'Question', value: question, inline: false },
        { name: 'Réponse', value: response, inline: false }
      ],
      footer: { text: `Demandé par ${message.author.tag}` }
    };

    return message.reply({ embeds: [embed] });
  }

  /**
   * Commande: !coinflip
   */
  async coinflip(message, args) {
    const result = this.coinSides[Math.floor(Math.random() * this.coinSides.length)];
    const embed = {
      color: 0xffd700,
      title: '🪙 Lancé de pièce',
      description: `**${result}** !`,
      footer: { text: `Lancé par ${message.author.tag}` }
    };

    return message.reply({ embeds: [embed] });
  }

  /**
   * Commande: !dice
   */
  async dice(message, args) {
    const sides = parseInt(args[0]) || 6;
    
    if (sides < 2 || sides > 100) {
      return message.reply('❌ Nombre de faces invalide (2-100).');
    }

    const result = Math.floor(Math.random() * sides) + 1;
    const embed = {
      color: 0x00ff00,
      title: '🎲 Lancé de dé',
      description: `Tu as lancé un dé à **${sides} faces** et obtenu **${result}** !`,
      footer: { text: `Lancé par ${message.author.tag}` }
    };

    return message.reply({ embeds: [embed] });
  }

  /**
   * Commande: !rps (pierre papier ciseaux)
   */
  async rps(message, args) {
    const userChoice = args[0]?.toLowerCase();
    
    if (!userChoice || !this.rpsChoices.includes(userChoice)) {
      return message.reply('❌ Choisis entre: pierre, papier ou ciseaux.');
    }

    const botChoice = this.rpsChoices[Math.floor(Math.random() * this.rpsChoices.length)];
    let result = '';
    let color = 0;

    if (userChoice === botChoice) {
      result = 'Égalité !';
      color = 0xffff00;
    } else if (
      (userChoice === 'pierre' && botChoice === 'ciseaux') ||
      (userChoice === 'papier' && botChoice === 'pierre') ||
      (userChoice === 'ciseaux' && botChoice === 'papier')
    ) {
      result = 'Tu as gagné ! 🎉';
      color = 0x00ff00;
    } else {
      result = 'J\'ai gagné ! 🤖';
      color = 0xff0000;
    }

    const emojis = {
      pierre: '🪨',
      papier: '📄',
      ciseaux: '✂️'
    };

    const embed = {
      color,
      title: '✊✋✌️ Pierre Papier Ciseaux',
      fields: [
        { name: 'Ton choix', value: `${emojis[userChoice]} ${userChoice}`, inline: true },
        { name: 'Mon choix', value: `${emojis[botChoice]} ${botChoice}`, inline: true },
        { name: 'Résultat', value: result, inline: false }
      ],
      footer: { text: `Joué par ${message.author.tag}` }
    };

    return message.reply({ embeds: [embed] });
  }

  /**
   * Commande: !meme
   */
  async meme(message, args) {
    const categories = Object.keys(this.memes);
    const chosenCategory = args[0]?.toLowerCase() || categories[Math.floor(Math.random() * categories.length)];
    
    const memeUrl = this.memes[chosenCategory];
    if (!memeUrl) {
      return message.reply(`❌ Catégories disponibles: ${categories.join(', ')}`);
    }

    const embed = {
      color: 0x9c27b0,
      title: '😂 Meme',
      image: { url: memeUrl },
      description: `Catégorie: ${chosenCategory}`,
      footer: { text: `Demandé par ${message.author.tag}` }
    };

    return message.reply({ embeds: [embed] });
  }

  /**
   * Commande: !joke
   */
  async joke(message, args) {
    const joke = this.jokes[Math.floor(Math.random() * this.jokes.length)];
    const embed = {
      color: 0xff9800,
      title: '😂 Blague de programmeur',
      description: joke,
      footer: { text: `Pour ${message.author.tag}` }
    };

    return message.reply({ embeds: [embed] });
  }

  /**
   * Commande: !fact
   */
  async fact(message, args) {
    const fact = this.facts[Math.floor(Math.random() * this.facts.length)];
    const embed = {
      color: 0x00bcd4,
      title: '📚 Saviez-vous que...',
      description: fact,
      footer: { text: `Pour ${message.author.tag}` }
    };

    return message.reply({ embeds: [embed] });
  }

  /**
   * Commande: !quote
   */
  async quote(message, args) {
    const quote = this.quotes[Math.floor(Math.random() * this.quotes.length)];
    const embed = {
      color: 0x795548,
      title: '💬 Citation inspirante',
      description: quote,
      footer: { text: `Pour ${message.author.tag}` }
    };

    return message.reply({ embeds: [embed] });
  }

  /**
   * Commande: !rate
   */
  async rate(message, args) {
    const thing = args.join(' ') || message.author.tag;
    const rating = Math.floor(Math.random() * 11);
    
    const stars = '⭐'.repeat(rating) + '☆'.repeat(10 - rating);
    
    const embed = {
      color: 0xffd700,
      title: '⭐ Évaluation',
      description: `Je donne à **${thing}** une note de **${rating}/10**\n${stars}`,
      footer: { text: `Évalué pour ${message.author.tag}` }
    };

    return message.reply({ embeds: [embed] });
  }

  /**
   * Commande: !choose
   */
  async choose(message, args) {
    const choices = args.join(' ').split(' ou ');
    
    if (choices.length < 2) {
      return message.reply('❌ Format: `!choose choix1 ou choix2 ou choix3`');
    }

    const choice = choices[Math.floor(Math.random() * choices.length)].trim();
    const embed = {
      color: 0x4caf50,
      title: '🎯 Choix aléatoire',
      description: `Je choisis: **${choice}**`,
      fields: [
        { name: 'Options', value: choices.map(c => `• ${c.trim()}`).join('\n'), inline: false }
      ],
      footer: { text: `Pour ${message.author.tag}` }
    };

    return message.reply({ embeds: [embed] });
  }

  /**
   * Commande: !ascii
   */
  async ascii(message, args) {
    const text = args.join(' ').slice(0, 50);
    if (!text) {
      return message.reply('❌ Donne du texte à convertir.');
    }

    // Convertion simple en ASCII art (basique)
    const asciiMap = {
      'a': ' /\n/__\\',
      'b': '|__ \n|__)',
      'c': ' __\n(  \n \\_)',
      'hello': ' _   _      _ _      \n| | | | ___| | | ___  \n| |_| |/ _ \\ | |/ _ \\ \n|  _  |  __/ | | (_) |\n|_| |_|\\___|_|_|\\___/'
    };

    const asciiText = asciiMap[text.toLowerCase()] || `Pas de conversion ASCII pour "${text}"`;
    
    return message.reply(`\`\`\`\n${asciiText}\n\`\`\``);
  }
}

module.exports = FunManager;