let userStatus = {}; // Cached friend statuses.
let friendUsernames = []; // Persistent friend list.
let mySolvedSet = new Set(); // Set of problem IDs solved by your username.

// Helper: save friendUsernames to localStorage.
function saveFriends() {
  localStorage.setItem("friendsList", JSON.stringify(friendUsernames));
}

$(function() {
  // Cache frequently used elements.
  const $usernameInput = $("#usernameInput"),
        $addFriendBtn = $("#addFriendBtn"),
        $friendsList = $("#friendsList"),
        $toggleFriendNames = $("#toggleFriendNames"),
        $blastThresholdInput = $("#blastThreshold"),
        $blastBtn = $("#blastBtn"),
        $luckyBtn = $("#luckyBtn"),
        $myUsernameInput = $("#myUsername"),
        $mySolvedCountDiv = $("#mySolvedCount");
  
  // Load my username and solved status.
  if (chrome && chrome.storage) {
    chrome.storage.local.get("myUsername", function(result) {
      if (result.myUsername) {
        $myUsernameInput.val(result.myUsername);
        fetchMyStatus(result.myUsername);
      }
    });
  } else {
    const stored = localStorage.getItem("myUsername");
    if (stored) {
      $myUsernameInput.val(stored);
      fetchMyStatus(stored);
    }
  }
  
  // Make myUsername editable.
  $myUsernameInput.on("click", function() {
    $(this).removeAttr("readonly");
  }).on("blur", function(){
    $(this).attr("readonly", "true");
    const uname = $.trim($myUsernameInput.val());
    if (uname) {
      if (chrome && chrome.storage) {
        chrome.storage.local.set({ myUsername: uname });
      } else {
        localStorage.setItem("myUsername", uname);
      }
      fetchMyStatus(uname);
    } else {
      console.error("No username provided; skipping fetchMyStatus.");
    }
  }).on("keyup", function(e) {
    if (e.key === "Enter") { $(this).blur(); alert("Your username has been saved!"); }
  });
  
  // Use jQuery's ajax and chaining to simplify fetching.
  function fetchMyStatus(username) {
    $.getJSON(`https://codeforces.com/api/user.status?handle=${username}`)
     .done(data => {
       if (data.status === "OK") {
         mySolvedSet = new Set(data.result.filter(s => s.verdict==="OK")
                                       .map(s => s.problem.contestId + s.problem.index));
         const count = mySolvedSet.size;
         $mySolvedCountDiv.text(count);
         localStorage.setItem("mySolvedCached", count);
         localStorage.setItem("myStatusLastUpdated", Date.now());
         const solvedKeysStr = JSON.stringify(Array.from(mySolvedSet));
         localStorage.setItem("mySolvedKeys", solvedKeysStr);
         if (chrome && chrome.storage) chrome.storage.local.set({ mySolvedKeys: solvedKeysStr });
         updateFriendPercentages();
       } else { console.error("Error fetching status for:", username); }
     })
     .fail(err => console.error("Fetch error for my status:", err));
  }
  
  // New: Update percentages for each friend DOM element.
  function updateFriendPercentages() {
    const $lis = $friendsList.children();
    $lis.each(function() {
      const $li = $(this);
      const friendName = $li.find('.username-text').text().trim();
      if (userStatus[friendName] && userStatus[friendName].solved.length > 0) {
        const solvedArr = userStatus[friendName].solved;
        // Compute number of friend's solved problems that I also solved.
        const common = solvedArr.filter(prob => mySolvedSet.has(prob)).length;
        let percentage = solvedArr.length > 0 ? (common / solvedArr.length * 100).toFixed(3) : "0.000";
        if (parseFloat(percentage) < 10) {
          percentage = "0" + percentage;
        }
        userStatus[friendName].percentage = percentage;
        let $notSolvedSpan = $li.find('.friend-not-solved');
        if (!$notSolvedSpan.length) {
          $notSolvedSpan = $("<span>").addClass("friend-not-solved");
          $li.find('.counts').append($notSolvedSpan);
        }
        $notSolvedSpan.text(percentage + "%");
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
      $mySolvedCountDiv.text(cachedCount);
    }
    if (!lastUpdated || (Date.now() - parseInt(lastUpdated)) > 60000) {
      fetchMyStatus($myUsernameInput.val().trim());
    }
  }
  
  // Load toggle setting.
  if (chrome && chrome.storage) {
    chrome.storage.local.get("showFullNames", function(result) {
      $toggleFriendNames.prop("checked", result.showFullNames !== undefined ? result.showFullNames : true);
    });
  }
  $toggleFriendNames.on("change", function() {
    if (chrome && chrome.storage) {
      chrome.storage.local.set({ showFullNames: $toggleFriendNames.prop("checked") });
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
    const $lis = $friendsList.children();
    $lis.sort((a, b) => {
      const userA = $(a).find('.username-text').text().trim();
      const userB = $(b).find('.username-text').text().trim();
      const solvedA = userStatus[userA] ? userStatus[userA].solved.length : 0;
      const solvedB = userStatus[userB] ? userStatus[userB].solved.length : 0;
      const triedA = userStatus[userA] ? userStatus[userA].tried.length : 0;
      const triedB = userStatus[userB] ? userStatus[userB].tried.length : 0;
      if (solvedA !== solvedB) return solvedB - solvedA;
      return triedB - triedA;
    });
    $lis.each(function() {
      $friendsList.append($(this));
    });
  }
  
  // Remove fetchUserStatus function and replace with updateFriendStatus using getUserStatus.
  function updateFriendStatus(username, $li) {
    getUserStatus(username).then(status => {
      userStatus[username] = status; // cache locally.
      // Update UI elements.
      const $solvedSpan = $li.find('.solved-count');
      const $triedSpan = $li.find('.tried-count');
      if ($solvedSpan.length) $solvedSpan.text(status.solved.length);
      if ($triedSpan.length) $triedSpan.text(status.tried.length);
      let common = status.solved.length > 0 && mySolvedSet.size > 0 ?
                   status.solved.filter(prob => mySolvedSet.has(prob)).length : 0;
      let percentage = status.solved.length > 0 ? (common / status.solved.length * 100).toFixed(3) : "0.000";
      userStatus[username].percentage = percentage;
      let $notSolvedSpan = $li.find('.friend-not-solved');
      if (!$notSolvedSpan.length) {
        $notSolvedSpan = $("<span>").addClass("friend-not-solved");
        $li.find('.counts').append($notSolvedSpan);
      }
      $notSolvedSpan.text(percentage + "%");
      if(chrome && chrome.storage) {
        chrome.storage.local.set({ userStatus, friendUsernames });
      }
      sortFriendList();
    }).catch(error => console.error("Error updating friend status:", error));
  }

  // Add a friend to UI.
  function addFriend(username, fromCache) {
    if (!fromCache && friendUsernames.includes(username)) return;
    const $li = $("<li>");
    const $friendInfo = $("<div>").addClass("friend-info");
    const $usernameLink = $("<a>").attr("href", `https://codeforces.com/profile/${username}`)
                                  .attr("target", "_blank")
                                  .addClass("username-text")
                                  .text(username);
    $friendInfo.append($usernameLink);
    const $countsDiv = $("<div>").addClass("counts");
    const $solvedSpan = $("<span>").addClass("solved-count").text("0");
    const $triedSpan = $("<span>").addClass("tried-count").text("0");
    $countsDiv.append($solvedSpan).append($triedSpan);
    $friendInfo.append($countsDiv);
    $li.append($friendInfo);
    
    const $actionsDiv = $("<div>").addClass("actions");
    const $refreshBtn = $("<button>").addClass("refresh-btn").html('<i class="material-icons">refresh</i>');
    $refreshBtn.on("click", function() {
      updateFriendStatus(username, $li);
    });
    $actionsDiv.append($refreshBtn);
    const $removeBtn = $("<button>").addClass("remove-btn").html('<i class="material-icons">delete</i>');
    $removeBtn.on("click", function() {
      $li.remove();
      friendUsernames = friendUsernames.filter(name => name !== username);
      saveFriends();
      delete userStatus[username];
      if(chrome && chrome.storage) {
        chrome.storage.local.set({ userStatus, friendUsernames });
      }
      sortFriendList();
    });
    $actionsDiv.append($removeBtn);
    $li.append($actionsDiv);
    $friendsList.append($li);
    
    if (!fromCache) {
      friendUsernames.push(username);
      saveFriends();
      if(chrome && chrome.storage) {
        chrome.storage.local.set({ userStatus, friendUsernames });
      }
      updateFriendStatus(username, $li);
    } else {
      if (userStatus[username]) {
        $solvedSpan.text(userStatus[username].solved.length);
        $triedSpan.text(userStatus[username].tried.length);
        let common = userStatus[username].solved.length > 0 && mySolvedSet.size > 0 ? 
                     userStatus[username].solved.filter(prob => mySolvedSet.has(prob)).length : 0;
        let percentage = userStatus[username].solved.length > 0 ? (common / userStatus[username].solved.length * 100).toFixed(3) : "0.000";
        userStatus[username].percentage = percentage;
        let $notSolvedSpan = $li.find('.friend-not-solved');
        if (!$notSolvedSpan.length) {
          $notSolvedSpan = $("<span>").addClass("friend-not-solved");
          $li.find('.counts').append($notSolvedSpan);
        }
        $notSolvedSpan.text(percentage + "%");
      } else {
        updateFriendStatus(username, $li);
      }
      sortFriendList();
    }
  }
  
  $addFriendBtn.on("click", function() {
    const uname = $.trim($usernameInput.val());
    if (uname) { addFriend(uname, false); $usernameInput.val(""); }
  });
  $usernameInput.on("keyup", function(e) {
    if (e.key === "Enter") $addFriendBtn.click();
  });
  
  $blastBtn.on("click", function() {
    const threshold = parseInt($blastThresholdInput.val(), 10);
    if (isNaN(threshold) || threshold < 1) { alert("Enter a valid positive integer as threshold."); return; }
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length) {
        chrome.tabs.sendMessage(tabs[0].id, { type:"blast", threshold }, function(response) {
          console.log("Blast completed. Opened count:", response ? response.opened : 0);
        });
      }
    });
  });
  
  $luckyBtn.on("click", function() {
    window.performLucky(friendUsernames, userStatus, mySolvedSet);
  });
});
