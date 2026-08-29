/**
 * Three surfaces, one bundle (D1):
 *   /          — a player's phone
 *   /screen    — the big screen
 *   /console   — the facilitator
 */
import { Console } from './pages/Console.js';
import { Phone } from './pages/Phone.js';
import { Screen } from './pages/Screen.js';

export function App() {
  const path = location.pathname;
  if (path.startsWith('/screen')) return <Screen />;
  if (path.startsWith('/console')) return <Console />;
  return <Phone />;
}
