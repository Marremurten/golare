/**
 * Swedish Guzman-persona message templates for all Phase 1 interactions.
 * Dynamic templates use functions; static messages use plain strings.
 */
export const MESSAGES = {
  /** Welcome message when user /start's the bot directly (no deep link) */
  WELCOME_DIRECT:
    "Yo bre, valkommen till familjen! 🤝\n" +
    "Jag ar Golare-boten -- jag haller koll pa allt och alla.\n" +
    "Du ar inne nu, shuno. Nar det ar dags att spela far du ett meddelande har. 🔥",

  /** Welcome message when user /start's via deep link from a group */
  WELCOME_DEEP_LINK: (groupName?: string) =>
    `Shuno, jag ser att du kommer fran gruppen${groupName ? ` ${groupName}` : ""}! 👀\n` +
    "Bra att du klickade, bre. Du ar registrerad nu.\n" +
    "Sitt tight -- jag hor av mig nar det ar game time. 🎯",

  /** Message when user /start's but is already registered */
  WELCOME_ALREADY_REGISTERED:
    "Bre, du ar redan inne. Lugn. 😎\n" +
    "Jag har koll pa dig, du behover inte gora nagonting mer.",

  /** Group announcement when a player completes /start via deep link */
  REGISTRATION_CONFIRMED_GROUP: (name: string) =>
    `${name} ar inne! 🔥 Valkomna till familjen, bre.`,

  /** Group message calling out an unregistered player with deep link */
  DM_CALLOUT: (name: string, link: string) =>
    `Yo ${name}, vad vantar du pa? 👊\n` +
    `Klicka har bre: ${link}`,

  /** Follow-up group reminder for player who still hasn't /start'd */
  DM_REMINDER: (name: string, link: string) =>
    `${name}... shuno, alla vantar pa dig. 😤\n` +
    `Tryck pa lanken nu bre, sluta para: ${link}`,

  /** Message when queue delay exceeds threshold */
  QUEUE_DELAY:
    "Lugn bre, jag haller pa... 🔄\n" +
    "Ge mig en sekund, det ar mycket som hander.",
} as const;
