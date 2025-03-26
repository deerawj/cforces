// Exports two functions: refreshUserStatus and getUserStatus.

// Refreshes data from Codeforces API for a given username.
function refreshUserStatus(username) {
  return fetch(`https://codeforces.com/api/user.status?handle=${username}`)
    .then(response => response.json())
    .then(data => {
      if (data.status !== "OK") {
        return Promise.reject("API error");
      }
      let problems = {};
      data.result.forEach(submission => {
        let key = submission.problem.contestId + submission.problem.index;
        if (!problems[key]) {
          problems[key] = { solved: false };
        }
        if (submission.verdict === "OK") {
          problems[key].solved = true;
        }
      });
      let solved = [];
      let tried = [];
      Object.keys(problems).forEach(key => {
        if (problems[key].solved) {
          solved.push(key);
        } else {
          tried.push(key);
        }
      });
      const status = { solved, tried };
      localStorage.setItem("userStatus_" + username, JSON.stringify(status));
      return status;
    });
}

// Returns the stored status for username if available; otherwise calls refreshUserStatus.
function getUserStatus(username) {
  const stored = localStorage.getItem("userStatus_" + username);
  if (stored) {
    return Promise.resolve(JSON.parse(stored));
  }
  return refreshUserStatus(username);
}

window.refreshUserStatus = refreshUserStatus;
window.getUserStatus = getUserStatus;
