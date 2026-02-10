/**
 * Varied error message arrays in Swedish Guzman persona.
 * Multiple variants per type to avoid repetitive bot responses.
 *
 * IMPORTANT: All Swedish text MUST use proper åäö characters.
 * Never substitute with a/a/o.
 */
export const ERROR_MESSAGES = {
  /** When /start registration fails */
  START_FAILED: [
    "Bre, det gick inte just nu. Skicka /start igen. 🔄",
    "Någonting gick snett, shuno. Testa /start en gång till. 💀",
    "Yo, det strulade till sig. Klick /start igen bre. 🤦",
    "Aah det funkade inte. Ge det ett till försök med /start. 🙏",
    "Para inte bre, det buggade bara. Kör /start igen. 🐛",
  ],

  /** Generic error messages for unexpected failures */
  GENERAL_ERROR: [
    "Shuno, någonting gick fel. Testa igen om en stund. 😬",
    "Bre, det är någon jävel som strular. Vi fixar det. 🔧",
    "Yo, det hände någonting konstigt. Försök igen snart. 💥",
    "Det blev lite para här. Testa igen om någon minut, bre. ⏳",
  ],

  /** When database operations fail */
  DB_ERROR: [
    "Någonting gick snett med minnet, bre. Försök igen. 🧠",
    "Yo, jag tappade tråden. Gör om det där, shuno. 📝",
    "Det strulade med systemet. Testa igen bre, lugnt. 💾",
    "Aah, det sparades inte. Kör en gång till, shuno. 🔁",
  ],

  /** When lobby operations fail unexpectedly */
  LOBBY_ERROR: [
    "Bre, lobbyn strulade till sig. Testa igen om en stund. 🎮",
    "Yo, det gick inte att fixa lobbyn just nu. Försök igen, shuno. 🔄",
    "Någonting hände med spelet, bre. Kör /nyttspel igen om det inte funkar. 💥",
    "Aah, lobbyn buggade. Ge det en sekund och testa igen, bre. 🐛",
    "Shuno, det blev lite strul med spelgrejen. Försök igen snart. ⚡",
  ],
} as const;

/** Error type keys */
export type ErrorType = keyof typeof ERROR_MESSAGES;

/**
 * Pick a random error message from the specified error type array.
 */
export function getRandomError(type: ErrorType): string {
  const messages = ERROR_MESSAGES[type];
  const index = Math.floor(Math.random() * messages.length);
  return messages[index];
}
