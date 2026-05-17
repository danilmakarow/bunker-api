/**
 * Status of a single RoomParticipant row. Soft-delete model — rows are kept
 * for history and rejoin checks. KICKED is sticky; LEFT can flip back to JOINED.
 */
export enum ParticipantStatusEnum {
  JOINED = 'JOINED',
  KICKED = 'KICKED',
  LEFT = 'LEFT',
}
