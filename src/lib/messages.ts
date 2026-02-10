/**
 * Swedish Guzman-persona message templates for all interactions.
 * Dynamic templates use functions; static messages use plain strings.
 *
 * IMPORTANT: All Swedish text MUST use proper åäö characters.
 * Never substitute with a/a/o.
 */
export const MESSAGES = {
  /** Welcome message when user /start's the bot directly (no deep link) */
  WELCOME_DIRECT:
    "Yo bre, välkommen till familjen! 🤝\n" +
    "Jag är Golare-boten -- jag håller koll på allt och alla.\n" +
    "Du är inne nu, shuno. När det är dags att spela får du ett meddelande här. 🔥",

  /** Welcome message when user /start's via deep link from a group */
  WELCOME_DEEP_LINK: (groupName?: string) =>
    `Shuno, jag ser att du kommer från gruppen${groupName ? ` ${groupName}` : ""}! 👀\n` +
    "Bra att du klickade, bre. Du är registrerad nu.\n" +
    "Sitt tight -- jag hör av mig när det är game time. 🎯",

  /** Message when user /start's but is already registered */
  WELCOME_ALREADY_REGISTERED:
    "Bre, du är redan inne. Lugn. 😎\n" +
    "Jag har koll på dig, du behöver inte göra någonting mer.",

  /** Group announcement when a player completes /start via deep link */
  REGISTRATION_CONFIRMED_GROUP: (name: string) =>
    `${name} är inne! 🔥 Välkomna till familjen, bre.`,

  /** Group message calling out an unregistered player with deep link */
  DM_CALLOUT: (name: string, link: string) =>
    `Yo ${name}, vad väntar du på? 👊\n` +
    `Klicka här bre: ${link}`,

  /** Follow-up group reminder for player who still hasn't /start'd */
  DM_REMINDER: (name: string, link: string) =>
    `${name}... shuno, alla väntar på dig. 😤\n` +
    `Tryck på länken nu bre, sluta para: ${link}`,

  /** Message when queue delay exceeds threshold */
  QUEUE_DELAY:
    "Lugn bre, jag håller på... 🔄\n" +
    "Ge mig en sekund, det är mycket som händer.",

  // -------------------------------------------------------------------------
  // Lobby messages (Phase 2)
  // -------------------------------------------------------------------------

  /** Guzman announces a new game lobby */
  LOBBY_CREATED: (adminName: string) =>
    `Yo, ${adminName} vill starta en stöt! 🔥\n` +
    "Vem är med? Tryck 'Jag är med!' bre.",

  /** Dynamic lobby status with player count and names */
  LOBBY_TEXT: (players: string[], maxPlayers: number) => {
    const count = players.length;
    const names = count > 0 ? players.join(", ") : "Inga än...";
    return (
      `${count}/${maxPlayers} spelare: ${names}\n\n` +
      "Tryck 'Jag är med!' för att hoppa in, bre."
    );
  },

  /** Lobby is full (max players reached) */
  LOBBY_FULL: "Fullt bre! Max 10 spelare. 🚫",

  /** Player hasn't /start'd the bot -- shown as toast */
  LOBBY_NOT_REGISTERED:
    "Du måste starta boten först! Skicka /start till mig privat. 👊",

  /** Player already in the game -- shown as toast */
  LOBBY_ALREADY_JOINED: "Du är redan med, bre. Lugn. 😎",

  /** Player tried to leave but isn't in the game -- shown as toast */
  LOBBY_NOT_IN_GAME: "Du är inte med i spelet, bre. 🤷",

  /** Not enough players to start -- shown as toast */
  LOBBY_MIN_PLAYERS: (min: number) =>
    `Det behövs minst ${min} spelare för att köra, bre. ⏳`,

  /** Non-admin tried to create a game */
  LOBBY_NOT_ADMIN: "Bara admins kan starta spel här, bre. 🚫",

  /** Group already has an active game */
  LOBBY_GAME_EXISTS:
    "Det finns redan ett spel igång i den här gruppen, bre! 🎮",

  /** No active game in the group */
  LOBBY_NO_GAME:
    "Det finns inget aktivt spel här, bre. Kör /nyttspel för att starta ett! 🎯",

  // -------------------------------------------------------------------------
  // Role reveal DMs (Phase 2, Plan 02)
  // -------------------------------------------------------------------------

  /** Role reveal DM for Äkta players */
  ROLE_REVEAL_AKTA:
    "Yo bre, lyssna noga...\n\n" +
    "Du är <b>ÄKTA</b>. Du tillhör <b>Ligan</b> -- vi är familjen. 🤝\n\n" +
    "Din uppgift: Genomför stötar framgångsrikt. Välj rätt folk till teamen, " +
    "och var jävligt noga med vem du litar på.\n\n" +
    "Vinst: <b>3 lyckade stötar</b> och Ligan vinner.\n\n" +
    "Men shuno... det finns Golare bland oss. Dom jobbar för Aina " +
    "och vill sabotera allt vi byggt. Lita inte på någon blint. 👀\n\n" +
    "Håll ögonen öppna. Familjen räknar med dig. 🔥",

  /** Role reveal DM for Golare players -- receives list of other Golare */
  ROLE_REVEAL_GOLARE: (otherGolare: string) => {
    const golareInfo = otherGolare
      ? `Dina bröder i skiten: ${otherGolare}. Ni vet om varandra -- använd det. 🤫`
      : "Du är ensam, bre. Ingen annan Golare. Allt hänger på dig. 💀";

    return (
      "Psst... kom hit, bre.\n\n" +
      "Du är <b>GOLARE</b>. Du jobbar för <b>Aina</b>. 🐀\n\n" +
      "Din uppgift: Sabotera Ligans stötar inifrån. Smyg dig in i teamen " +
      "och välj [Gola] när det gäller. Men var försiktig -- om dom fattar " +
      "att du är en råtta så är du rökt.\n\n" +
      `${golareInfo}\n\n` +
      "Vinst: <b>3 saboterade stötar</b> och Aina vinner.\n\n" +
      "Spela ditt spel smart. Ljug, manipulera, peka finger åt andra. " +
      "Gör vad du måste. Bara bli inte avslöjad. 🎭"
    );
  },

  /** Role reveal DM for Högra Hand (Guzmans Högra Hand) */
  ROLE_REVEAL_HOGRA_HAND:
    "Yo... kom närmare. Det här stannar mellan oss. 🤫\n\n" +
    "Du är <b>Guzmans Högra Hand</b>. Du tillhör <b>Ligan</b>, " +
    "men du har en specialposition som ingen annan vet om.\n\n" +
    "Din förmåga: <b>Spaning</b> -- en gång under hela spelet kan du " +
    "kolla en spelares riktiga roll. Använd det klokt, bre. " +
    "Det kan ändra allt. 🔍\n\n" +
    "Ditt mål: Hjälp Ligan vinna stötar och guida gruppen rätt -- " +
    "men gör det subtilt. Om Golare listar ut att du är Högra Hand " +
    "kan dom stjäla vinsten i slutet.\n\n" +
    "Du har Guzmans förtroende. Svek det inte. 👊\n\n" +
    "Vinst: <b>3 lyckade stötar</b> och Ligan vinner. " +
    "Men håll dig gömd -- du är Golares största mål. 🎯",

  // -------------------------------------------------------------------------
  // Game start & cancellation (Phase 2, Plan 02)
  // -------------------------------------------------------------------------

  /** Dramatic Guzman monologue posted to group when game starts */
  GAME_START_MONOLOGUE:
    "<b>Ligan... lyssna upp.</b> 🎬\n\n" +
    "Nånting luktar fisk i byn, bre. Jag har hört rykten... " +
    "det finns <b>Golare</b> bland oss. Råttor som jobbar för Aina. 🐀\n\n" +
    "Men vi kör ändå. Vi har stötar att genomföra. " +
    "Varje runda väljer en <b>Capo</b> sitt team -- " +
    "och gruppen röstar om dom litar på valet.\n\n" +
    "Teamet går sen in och gör jobbet. " +
    "Eller... saboterar det inifrån. 👀\n\n" +
    "<b>3 lyckade stötar</b> och Ligan vinner. " +
    "<b>3 saboterade</b> och Aina tar hem det.\n\n" +
    "Kolla era DMs -- ni har fått era roller. " +
    "Lita inte på någon. <b>Spelet börjar nu.</b> 🔥",

  /** Group announcement when admin cancels the game */
  GAME_CANCELLED: (adminName: string) =>
    `${adminName} drog i nödbromsen. Spelet är avbrutet, bre. 🚫`,

  /** answerCallbackQuery confirmation for admin on cancel */
  GAME_CANCEL_CONFIRM: "Spelet avbrutet. 🚫",
} as const;
