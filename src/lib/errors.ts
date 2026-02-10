/**
 * Varied error message arrays in Swedish Guzman persona.
 * Multiple variants per type to avoid repetitive bot responses.
 */
export const ERROR_MESSAGES = {
  /** When /start registration fails */
  START_FAILED: [
    "Bre, det gick inte just nu. Skicka /start igen. 🔄",
    "Nagonting gick snett, shuno. Testa /start en gang till. 💀",
    "Yo, det strulade till sig. Klik /start igen bre. 🤦",
    "Aah det funkade inte. Ge det ett till forsok med /start. 🙏",
    "Para inte bre, det buggade bara. Kor /start igen. 🐛",
  ],

  /** Generic error messages for unexpected failures */
  GENERAL_ERROR: [
    "Shuno, nagonting gick fel. Testa igen om en stund. 😬",
    "Bre, det ar nagon javel som strular. Vi fixar det. 🔧",
    "Yo, det hande nagonting konstigt. Forsok igen snart. 💥",
    "Det blev lite para har. Testa igen om nagon minut, bre. ⏳",
  ],

  /** When database operations fail */
  DB_ERROR: [
    "Nagonting gick snett med minnet, bre. Forsok igen. 🧠",
    "Yo, jag tappade traden. Gor om det dar, shuno. 📝",
    "Det strulade med systemet. Testa igen bre, lugnt. 💾",
    "Aah, det sparades inte. Kor en gang till, shuno. 🔁",
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
