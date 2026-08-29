import WebSocket from 'ws';
const url = 'ws://localhost:3101/ws';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const open = (name) => new Promise((resolve) => {
  const ws = new WebSocket(url);
  ws.inbox = [];
  ws.on('message', (raw) => ws.inbox.push(JSON.parse(raw.toString())));
  ws.on('open', () => resolve(ws));
  ws.name = name;
});
const send = (ws, msg) => ws.send(JSON.stringify(msg));
const lastOf = (ws, type) => [...ws.inbox].reverse().find((m) => m.type === type);

const facilitator = await open('fac');
send(facilitator, { type: 'create-room', caseId: 'blackwood-hall' });
await wait(200);
const roomCode = lastOf(facilitator, 'room-created').roomCode;
console.log('room', roomCode);

const screen = await open('screen');
send(screen, { type: 'join', role: 'screen', roomCode });

const phones = [];
for (const name of ['Ana', 'Ben', 'Cat', 'Dev', 'Eve']) {
  const p = await open(name);
  send(p, { type: 'join', role: 'phone', roomCode, name });
  phones.push(p);
}
await wait(300);
send(facilitator, { type: 'facilitator', action: 'start' });
await wait(300);

const anaView = lastOf(phones[0], 'phone-view');
console.log('Ana hand:', anaView.hand.length, 'clues; character:', anaView.character.name);
send(phones[0], { type: 'move', move: { type: 'table', playerId: anaView.playerId, clueId: anaView.hand[0].id } });
const benView = lastOf(phones[1], 'phone-view');
send(phones[1], { type: 'move', move: { type: 'ask-suspect', playerId: benView.playerId, questionId: 'q1', suspectId: 's-reeves', text: 'Were the doors bolted all night?' } });
await wait(500);
const answer = lastOf(screen, 'suspect-answer');
console.log('Reeves answers (fromBank=' + answer.fromBank + '):', answer.answer.slice(0, 80));

for (let act = 1; act <= 3; act++) {
  send(facilitator, { type: 'facilitator', action: 'open-commitment' });
  await wait(150);
  const v = lastOf(phones[2], 'phone-view');
  if (v.commitment) send(phones[2], { type: 'move', move: { type: 'commit-vote', playerId: v.playerId, commitmentId: v.commitment.id, choice: v.commitment.options[0].id } });
  await wait(150);
  send(facilitator, { type: 'facilitator', action: 'next-act' });
  await wait(200);
}
const finalScreen = lastOf(screen, 'screen-view');
console.log('phase:', finalScreen.phase, '| strengths:', finalScreen.reveal?.strengths.map((s) => `${s.name}:${s.strength}`).join(', '));
const anaFinal = lastOf(phones[0], 'phone-view');
console.log('Ana private read:', anaFinal.privateReveal.headline, '|', anaFinal.privateReveal.evidence[0]);
const facFinal = lastOf(facilitator, 'console-view');
console.log('team shape:', facFinal.teamReveal.shape.slice(0, 90));
process.exit(0);
