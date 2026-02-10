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
} as const;
