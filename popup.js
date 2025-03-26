let userStatus = {}; // Cached friend statuses.
let friendUsernames = []; // Persistent friend list.
let mySolvedSet = new Set(); // Set of problem IDs solved by your username.

// Helper: save friendUsernames to localStorage.
function saveFriends() {
  localStorage.setItem("friendsList", JSON.stringify(friendUsernames));
}

document.addEventListener("DOMContentLoaded", function() {
  const usernameInput = document.getElementById("usernameInput");
  const addFriendBtn = document.getElementById("addFriendBtn");
  const friendsList = document.getElementById("friendsList");
  const toggleFriendNames = document.getElementById("toggleFriendNames");
  const blastThresholdInput = document.getElementById("blastThreshold");
  const blastBtn = document.getElementById("blastBtn");
  const luckyBtn = document.getElementById("luckyBtn");
  
  // "Your Username" element and solved count display.
  const myUsernameInput = document.getElementById("myUsername");
  const mySolvedCountDiv = document.getElementById("mySolvedCount");
  
  // Load your username.
  if (chrome && chrome.storage) {
    chrome.storage.local.get("myUsername", function(result) {
      if (result.myUsername) {
        myUsernameInput.value = result.myUsername;
        fetchMyStatus(result.myUsername);
      }
    });
  } else {
    const storedMyUsername = localStorage.getItem("myUsername");
    if (storedMyUsername) {
      myUsernameInput.value = storedMyUsername;
      fetchMyStatus(storedMyUsername);
    }
  }
  
  // Make the username box editable on click and save on blur or Enter.
  myUsernameInput.addEventListener("click", function() {
    this.removeAttribute("readonly");
  });
  myUsernameInput.addEventListener("blur", function() {
    this.setAttribute("readonly", "true");
    const myUsername = myUsernameInput.value.trim();
    if (myUsername) {
      if (chrome && chrome.storage) {
        chrome.storage.local.set({ myUsername: myUsername });
      } else {
        localStorage.setItem("myUsername", myUsername);
      }
      fetchMyStatus(myUsername); // Only call if username isn't empty
    } else {
      console.error("No username provided; skipping fetchMyStatus.");
    }
  });
  myUsernameInput.addEventListener("keyup", function(e) {
    if (e.key === "Enter") {
      myUsernameInput.blur();
      alert("Your username has been saved!");
    }
  });
  
  // Function to fetch your solved problems.
  function fetchMyStatus(username) {
    fetch(`https://codeforces.com/api/user.status?handle=${username}`)
      .then(response => response.json())
      .then(data => {
        if (data.status === "OK") {
          let solvedSet = new Set();
          data.result.forEach(submission => {
            if (submission.verdict === "OK") {
              let key = submission.problem.contestId + submission.problem.index;
              solvedSet.add(key);
            }
          });
          mySolvedSet = solvedSet;
          const count = mySolvedSet.size;
          mySolvedCountDiv.textContent = count;
          localStorage.setItem("mySolvedCached", count);
          localStorage.setItem("myStatusLastUpdated", Date.now());
          const solvedKeysStr = JSON.stringify(Array.from(mySolvedSet));
          localStorage.setItem("mySolvedKeys", solvedKeysStr);
          // ALSO update chrome.storage so that content.js can get the proper value.
          if (chrome && chrome.storage) {
            chrome.storage.local.set({ mySolvedKeys: solvedKeysStr });
          }
          updateFriendPercentages();
        } else {
          console.error("Error fetching status for your username:", username);
        }
      })
      .catch(err => console.error("Fetch error for my status:", err));
  }

  // New: Update percentages for each friend DOM element.
  function updateFriendPercentages() {
    const lis = Array.from(friendsList.children);
    lis.forEach(li => {
      const friendName = li.querySelector('.username-text').textContent.trim();
      if (userStatus[friendName] && userStatus[friendName].solved.length > 0) {
        const solvedArr = userStatus[friendName].solved;
        // Compute number of friend's solved problems that I also solved.
        const common = solvedArr.filter(prob => mySolvedSet.has(prob)).length;
        let percentage = solvedArr.length > 0 ? (common / solvedArr.length * 100).toFixed(3) : "0.000";
        if (parseFloat(percentage) < 10) {
          percentage = "0" + percentage;
        }
        userStatus[friendName].percentage = percentage;
        let notSolvedSpan = li.querySelector('.friend-not-solved');
        if (!notSolvedSpan) {
          notSolvedSpan = document.createElement("span");
          notSolvedSpan.className = "friend-not-solved";
          li.querySelector('.counts').appendChild(notSolvedSpan);
        }
        notSolvedSpan.textContent = percentage + "%";
      }
    });
    if (chrome && chrome.storage) {
      chrome.storage.local.set({ userStatus });
    }
  }

  // On popup load, show cached mySolvedCount (if any) and update if older than 1 minute.
  {
    const cachedCount = localStorage.getItem("mySolvedCached");
    const lastUpdated = localStorage.getItem("myStatusLastUpdated");
    if (cachedCount !== null) {
      mySolvedCountDiv.textContent = cachedCount;
    }
    if (!lastUpdated || (Date.now() - parseInt(lastUpdated)) > 60000) {
      fetchMyStatus(myUsernameInput.value.trim());
    }
  }
  
  // Load toggle setting.
  if (chrome && chrome.storage) {
    chrome.storage.local.get("showFullNames", function(result) {
      toggleFriendNames.checked = result.showFullNames !== undefined ? result.showFullNames : true;
    });
  }
  toggleFriendNames.addEventListener("change", function() {
    if (chrome && chrome.storage) {
      chrome.storage.local.set({ showFullNames: toggleFriendNames.checked });
    }
  });
  
  // Load cached friend data.
  const saved = localStorage.getItem("friendsList");
  if (saved) {
    friendUsernames = JSON.parse(saved);
  }
  if (chrome && chrome.storage) {
    chrome.storage.local.get("userStatus", function(result) {
      userStatus = result.userStatus || {};
      friendUsernames.forEach(username => {
        addFriend(username, true);
      });
    });
  } else {
    friendUsernames.forEach(username => {
      addFriend(username, true);
    });
  }
  
  // Sort friend list.
  function sortFriendList() {
    const lis = Array.from(friendsList.children);
    lis.sort((a, b) => {
      const userA = a.querySelector('.username-text').textContent.trim();
      const userB = b.querySelector('.username-text').textContent.trim();
      const solvedA = userStatus[userA] ? userStatus[userA].solved.length : 0;
      const solvedB = userStatus[userB] ? userStatus[userB].solved.length : 0;
      const triedA = userStatus[userA] ? userStatus[userA].tried.length : 0;
      const triedB = userStatus[userB] ? userStatus[userB].tried.length : 0;
      if (solvedA !== solvedB) return solvedB - solvedA;
      return triedB - triedA;
    });
    lis.forEach(li => friendsList.appendChild(li));
  }
  
  // Remove fetchUserStatus function and replace with updateFriendStatus using getUserStatus.
  function updateFriendStatus(username, li) {
    getUserStatus(username).then(status => {
      userStatus[username] = status; // cache locally.
      // Update UI elements.
      const solvedSpan = li.querySelector('.solved-count');
      const triedSpan = li.querySelector('.tried-count');
      if (solvedSpan) solvedSpan.textContent = status.solved.length;
      if (triedSpan) triedSpan.textContent = status.tried.length;
      let common = status.solved.length > 0 && mySolvedSet.size > 0 ?
                   status.solved.filter(prob => mySolvedSet.has(prob)).length : 0;
      let percentage = status.solved.length > 0 ? (common / status.solved.length * 100).toFixed(3) : "0.000";
      userStatus[username].percentage = percentage;
      let notSolvedSpan = li.querySelector('.friend-not-solved');
      if (!notSolvedSpan) {
        notSolvedSpan = document.createElement("span");
        notSolvedSpan.className = "friend-not-solved";
        li.querySelector('.counts').appendChild(notSolvedSpan);
      }
      notSolvedSpan.textContent = percentage + "%";
      if(chrome && chrome.storage) {
        chrome.storage.local.set({ userStatus, friendUsernames });
      }
      sortFriendList();
    }).catch(error => console.error("Error updating friend status:", error));
  }

  // Add a friend to UI.
  function addFriend(username, fromCache) {
    if (!fromCache && friendUsernames.includes(username)) return;
    const li = document.createElement("li");
    const friendInfo = document.createElement("div");
    friendInfo.className = "friend-info";
    const usernameLink = document.createElement("a");
    usernameLink.href = `https://codeforces.com/profile/${username}`;
    usernameLink.target = "_blank";
    usernameLink.className = "username-text";
    usernameLink.textContent = username;
    friendInfo.appendChild(usernameLink);
    const countsDiv = document.createElement("div");
    countsDiv.className = "counts";
    const solvedSpan = document.createElement("span");
    solvedSpan.className = "solved-count";
    solvedSpan.textContent = "0";
    countsDiv.appendChild(solvedSpan);
    const triedSpan = document.createElement("span");
    triedSpan.className = "tried-count";
    triedSpan.textContent = "0";
    countsDiv.appendChild(triedSpan);
    friendInfo.appendChild(countsDiv);
    li.appendChild(friendInfo);
    
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "actions";
    const refreshBtn = document.createElement("button");
    refreshBtn.className = "refresh-btn";
    refreshBtn.innerHTML = '<i class="material-icons">refresh</i>';
    refreshBtn.addEventListener("click", function() {
      updateFriendStatus(username, li);
    });
    actionsDiv.appendChild(refreshBtn);
    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.innerHTML = '<i class="material-icons">delete</i>';
    removeBtn.addEventListener("click", function() {
      friendsList.removeChild(li);
      friendUsernames = friendUsernames.filter(name => name !== username);
      saveFriends();
      delete userStatus[username];
      if(chrome && chrome.storage) {
        chrome.storage.local.set({ userStatus, friendUsernames });
      }
      sortFriendList();
    });
    actionsDiv.appendChild(removeBtn);
    li.appendChild(actionsDiv);
    friendsList.appendChild(li);
    
    if (!fromCache) {
      friendUsernames.push(username);
      saveFriends();
      if(chrome && chrome.storage) {
        chrome.storage.local.set({ userStatus, friendUsernames });
      }
      updateFriendStatus(username, li);
    } else {
      if (userStatus[username]) {
        solvedSpan.textContent = userStatus[username].solved.length;
        triedSpan.textContent = userStatus[username].tried.length;
        let common = userStatus[username].solved.length > 0 && mySolvedSet.size > 0 ? 
                     userStatus[username].solved.filter(prob => mySolvedSet.has(prob)).length : 0;
        let percentage = userStatus[username].solved.length > 0 ? (common / userStatus[username].solved.length * 100).toFixed(3) : "0.000";
        userStatus[username].percentage = percentage;
        let notSolvedSpan = li.querySelector('.friend-not-solved');
        if (!notSolvedSpan) {
          notSolvedSpan = document.createElement("span");
          notSolvedSpan.className = "friend-not-solved";
          li.querySelector('.counts').appendChild(notSolvedSpan);
        }
        notSolvedSpan.textContent = percentage + "%";
      } else {
        updateFriendStatus(username, li);
      }
      sortFriendList();
    }
  }
  
  addFriendBtn.addEventListener("click", function() {
    const username = usernameInput.value.trim();
    if (username) {
      addFriend(username, false);
      usernameInput.value = "";
    }
  });
  usernameInput.addEventListener("keyup", function(e) {
    if (e.key === "Enter") addFriendBtn.click();
  });
  
  blastBtn.addEventListener("click", function() {
    const threshold = parseInt(blastThresholdInput.value, 10);
    if (isNaN(threshold) || threshold < 1) {
      alert("Please enter a valid positive integer as threshold.");
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "blast", threshold: threshold }, function(response) {
          console.log("Blast completed. Opened count:", response ? response.opened : 0);
        });
      }
    });
  });

  luckyBtn.addEventListener("click", function() {
    // Call the separate lucky logic. It uses friendUsernames, userStatus, and mySolvedSet.
    // Note: Ensure that friendUsernames and userStatus are up-to-date.
    window.performLucky(friendUsernames, userStatus, mySolvedSet);
  });
});
