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

export const getParsedRequesterRoles = (requesterRoles: string[]): string[] => {
  const roles = Array.isArray(requesterRoles)
    ? requesterRoles.map((role) => String(role))
    : [];
  const emojiRegex =
    /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
  const rolesWithoutEmojis = roles.filter(
    (role: string) => !emojiRegex.test(role)
  );
  return rolesWithoutEmojis;
};
