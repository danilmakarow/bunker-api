/**
 * Lifecycle states for a Room. Transitions are linear:
 *   LOBBY -> IN_GAME -> FINISHED
 *   LOBBY | IN_GAME -> ABANDONED  (when the last participant leaves)
 */
export enum RoomStatusEnum {
  LOBBY = 'LOBBY',
  IN_GAME = 'IN_GAME',
  FINISHED = 'FINISHED',
  ABANDONED = 'ABANDONED',
}
