function performLucky(friendUsernames, userStatus, mySolvedSet) {
  const freq = {};
  // Tally problems solved by friends (only those you haven't solved)
  friendUsernames.forEach(friend => {
    if (userStatus[friend] && userStatus[friend].solved) {
      userStatus[friend].solved.forEach(problem => {
        if (!mySolvedSet.has(problem)) {
          freq[problem] = (freq[problem] || 0) + 1;
        }
      });
    }
  });
  // Create a weighted array: each problem appears (frequency^2) times.
  let weightedList = [];
  Object.keys(freq).forEach(problemKey => {
    const weight = Math.pow(freq[problemKey], 2);
    for (let i = 0; i < weight; i++) {
      weightedList.push(problemKey);
    }
  });
  if (weightedList.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * weightedList.length);
  const chosenKey = weightedList[randomIndex];
  const match = chosenKey.match(/^(\d+)([A-Z][0-9A-Z]*)$/);
  if (!match) return null;
  const contestId = match[1];
  const index = match[2];
  const url = `https://codeforces.com/problemset/problem/${contestId}/${index}`;
  window.open(url, '_blank');
  return url;
}

window.performLucky = performLucky;
