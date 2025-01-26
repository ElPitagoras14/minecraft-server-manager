export const getNewPort = (portList: number[]): number => {
  if (portList.length === 0) {
    return 25565;
  }
  const startPort = 25565;
  const endPort = portList[portList.length - 1];
  const numberArray = Array.from(
    { length: endPort - startPort + 1 },
    (_, i) => i + startPort
  );
  const availablePorts = numberArray.filter((port) => !portList.includes(port));
  if (availablePorts.length === 0) {
    return endPort + 1;
  }
  return availablePorts[0];
};
