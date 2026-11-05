import { useRoomContext } from '../context/RoomContext';

export const useRoom = () => {
  return useRoomContext();
};

export default useRoom;

