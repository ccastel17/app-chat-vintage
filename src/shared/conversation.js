// Un mensaje es "mío" (saliente, para quien lo mira) de forma distinta
// según el tipo de conversación:
//  - 'simulated': el director define explícitamente `direction` (no hay
//    otro actor real del otro lado).
//  - 'linked': el mismo mensaje es saliente para quien lo escribió y
//    entrante para el otro actor — no puede ser un valor fijo, se calcula
//    comparando `sender_room_id` contra el room_id de quien mira.
export function isOutgoing(conversation, message, myRoomId) {
  if (conversation.kind === "linked") {
    return message.sender_room_id === myRoomId;
  }
  return message.direction === "outgoing";
}
