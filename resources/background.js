chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // informing the sync status to the user
  if (request.message === 'syncProjects') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: './logo.png',
      title: 'Projects synced!',
      message: request.data
    });
  } 
  // called from popup.js: favoriteChange()
  else if(request.message === 'favoriteChange') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: './logo.png',
      title: 'Favorite changed!',
      message: request.text
    });
  }
  return true;
});