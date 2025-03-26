function performBlast(threshold, mySolvedKeys) {
  const anchors = document.querySelectorAll("a.fc-annotated");
  const linksSet = new Set();
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
        const match = href.match(regex1) || href.match(regex2);
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
  return linksArray;
}

window.performBlast = performBlast;
