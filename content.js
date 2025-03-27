// Annotate anchors using either link format.
if (window.location.hostname.indexOf("codeforces.com") !== -1) {
  window.addEventListener("load", function() {
    chrome.storage.local.get(["userStatus", "friendUsernames", "showFullNames"], function(result) {
      const storedStatus = result.userStatus || {};
      const friends = result.friendUsernames || [];
      const showFullNames = result.showFullNames !== undefined ? result.showFullNames : true;
      // Select anchors whose href contains either pattern.
      const anchors = document.querySelectorAll("a[href*='/problemset/problem/'], a[href*='/contest/']");
      anchors.forEach(anchor => {
        const href = anchor.getAttribute("href");
        const regex1 = /problemset\/problem\/(\d+)\/([A-Z][0-9A-Z]*)/;
        const regex2 = /contest\/(\d+)\/problem\/([A-Z][0-9A-Z]*)/;
        let match = href.match(regex1) || href.match(regex2);
        if (match) {
          const problemKey = match[1] + match[2];
          let solvedBy = [];
          friends.forEach(friend => {
            if (
              storedStatus[friend] &&
              storedStatus[friend].solved &&
              storedStatus[friend].solved.indexOf(problemKey) !== -1
            ) {
              solvedBy.push(friend);
            }
          });
          if (solvedBy.length) {
            const annotation = showFullNames
              ? '[' + solvedBy.join(", ") + ']'
              : '[' + solvedBy.length + ']';
            anchor.classList.add("fc-annotated");
            // Check if anchor text is simple (one word, <=6 chars, matching pattern).
            const anchorText = anchor.textContent.trim();
            const simplePattern = /^\d+[A-Z]\d?$/;
            const isSimple = anchorText.indexOf(" ") === -1 && anchorText.length <= 6 && simplePattern.test(anchorText);
            if (!isSimple) {
              anchor.innerHTML = '<span class="friend-names">' + annotation + '</span> ' + anchor.innerHTML;
            }
          }
        }
      });
    });
  });
}

// Blast message listener: support both link formats.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "blast") {
    const threshold = message.threshold;
    const currentUrl = window.location.href;
    // If we are exactly on the homepage.
    if (currentUrl === "https://codeforces.com/" || currentUrl === "https://codeforces.com") {
      chrome.storage.local.get(["userStatus", "friendUsernames", "mySolvedKeys"], function(result) {
        const storedStatus = result.userStatus || {};
        const friends = result.friendUsernames || [];
        const mySolvedKeys = result.mySolvedKeys ? JSON.parse(result.mySolvedKeys) : [];
        const freq = {};
        // Count frequencies of problems solved by friends that you haven't solved.
        friends.forEach(friend => {
          if (storedStatus[friend] && storedStatus[friend].solved) {
            storedStatus[friend].solved.forEach(problem => {
              if (mySolvedKeys.indexOf(problem) === -1) {
                freq[problem] = (freq[problem] || 0) + 1;
              }
            });
          }
        });
        // Sort problems by frequency descending.
        const sortedProblems = Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
        const topProblems = sortedProblems.slice(0, 8);
        let openedCount = 0;
        topProblems.forEach(problemKey => {
          const match = problemKey.match(/^(\d+)([A-Z][0-9A-Z]*)$/);
          if (match) {
            const contestId = match[1];
            const index = match[2];
            const url = `https://codeforces.com/problemset/problem/${contestId}/${index}`;
            window.open(url, '_blank');
            openedCount++;
          }
        });
        sendResponse({ opened: openedCount });
      });
    } else {
      // Normal blast behavior.
      chrome.storage.local.get(["mySolvedKeys"], function(result) {
        const mySolvedKeys = result.mySolvedKeys ? JSON.parse(result.mySolvedKeys) : [];
        const linksSet = new Set();
        const anchors = document.querySelectorAll("a.fc-annotated");
        anchors.forEach(anchor => {
          const friendSpan = anchor.querySelector(".friend-names");
          if (friendSpan) {
            const text = friendSpan.textContent.trim();
            const inner = text.slice(1, text.indexOf("]"));
            let count = /^\d+$/.test(inner)
              ? parseInt(inner, 10)
              : inner.split(",").map(s => s.trim()).length;
            if (count >= threshold) {
              const href = anchor.getAttribute("href");
              const regex1 = /problemset\/problem\/(\d+)\/([A-Z][0-9A-Z]*)/;
              const regex2 = /contest\/(\d+)\/problem\/([A-Z][0-9A-Z]*)/;
              let match = href.match(regex1) || href.match(regex2);
              if (match) {
                const problemKey = match[1] + match[2];
                if (mySolvedKeys.indexOf(problemKey) === -1) {
                  linksSet.add(anchor.href);
                }
              }
            }
          }
        });
        const linksArray = Array.from(linksSet).slice(0, 16);
        linksArray.forEach(link => window.open(link, '_blank'));
        sendResponse({ opened: linksArray.length });
      });
    }
    return true;
  }
});

// Floating info box: support both link formats.
(function() {
  const regex1 = /problemset\/problem\/(\d+)\/([A-Z][0-9A-Z]*)$/;
  const regex2 = /contest\/(\d+)\/problem\/([A-Z][0-9A-Z]*)$/;
  const match = window.location.href.match(regex1) || window.location.href.match(regex2);
  if (!match) return;
  const problemKey = match[1] + match[2];
  chrome.storage.local.get(["userStatus", "friendUsernames"], function(result) {
    const storedStatus = result.userStatus || {};
    const friends = result.friendUsernames || [];
    let solvedFriends = [];
    let triedFriends = [];
    friends.forEach(friend => {
      if (storedStatus[friend]) {
        if (storedStatus[friend].solved && storedStatus[friend].solved.indexOf(problemKey) !== -1) {
          solvedFriends.push(friend);
        } else if (storedStatus[friend].tried && storedStatus[friend].tried.indexOf(problemKey) !== -1) {
          triedFriends.push(friend);
        }
      }
    });
    fetch(chrome.runtime.getURL("problemBox.html"))
      .then(response => response.text())
      .then(html => {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = html;
        const box = tempDiv.firstElementChild;
        const solvedHeader = box.querySelector("#fc-solved-header");
        const solvedList = box.querySelector("#fc-solved-list");
        const triedHeader = box.querySelector("#fc-tried-header");
        const triedList = box.querySelector("#fc-tried-list");
        solvedHeader.textContent = "Solved (" + solvedFriends.length + "):";
        solvedList.textContent = solvedFriends.length ? solvedFriends.join(", ") : "None";
        triedHeader.textContent = "Tried (" + triedFriends.length + "):";
        triedList.textContent = triedFriends.length ? triedFriends.join(", ") : "None";
        box.addEventListener("click", () => box.remove());
        document.body.appendChild(box);
      });
  });
})();
