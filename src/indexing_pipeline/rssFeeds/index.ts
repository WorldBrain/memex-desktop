// // function that takes the a RSS url and iterates through it

// export async function indexRSSfeed(feedUrl) {
//   const isExisting = null; // fetch local database entry and see if there is one already
//   let feedData;

//   feedData = new Promise((resolve, reject) => {
//     let xhr = new XMLHttpRequest();
//     xhr.open("GET", feedUrl);
//     xhr.onload = function() {
//       if (xhr.status === 200) {
//         resolve(xhr.responseText);
//       } else {
//         reject(new Error("Failed to load RSS feed: " + xhr.status));
//       }
//     };
//     xhr.send();
//   });

//   try {
//     const data = await feedData;
//     let parser = new DOMParser();
//     let xmlDoc = parser.parseFromString(data as string, "text/xml");
//     let feedTitle = xmlDoc
//       .getElementsByTagName("channel")[0]
//       .getElementsByTagName("title")[0].childNodes[0].nodeValue;
//     let feedDescription = xmlDoc
//       .getElementsByTagName("channel")[0]
//       .getElementsByTagName("description")[0].childNodes[0].nodeValue;
//     let feedIcon = xmlDoc
//       .getElementsByTagName("channel")[0]
//       .getElementsByTagName("icon")[0].childNodes[0].nodeValue;

//     const RSSfeedData = {
//       feedTitle: feedTitle,
//       feedUrl: feedUrl,
//       feedIcon: feedIcon,
//       feedDescription: feedDescription,
//     };

//     let items = xmlDoc.getElementsByTagName("item");

//     const articles = [];
//     for (let i = 0; i < items.length; i++) {
//       let item = items[i];
//       // You can now use the item variable to access each item in the RSS feed

//       let title = item.getElementsByTagName("title")[0].textContent;

//       // [0].childNodes[0].nodeValue
//       let description = item.getElementsByTagName("description")[0].textContent;
//       let link = item.getElementsByTagName("link")[0].textContent;
//       let pubDate = item.getElementsByTagName("pubDate")[0].textContent;
//       let content = item.getElementsByTagName("content:encoded")[0].textContent;
//       let createdWhen = new Date(pubDate).getTime();

//       // Create a new DOMParser to parse the HTML string
//       let parser = new DOMParser();
//       // Parse the HTML string to a document
//       let contentDoc = parser.parseFromString(content, "text/html");
//       // Get the innerText of the document
//       const textContent = contentDoc.body.innerText;

//       const document = {
//         listId: ListData.localListId,
//         pageUrl: normalizeUrl(link),
//         fullUrl: link,
//         createdAt: createdWhen,
//         pageTitle: title,
//         isShared: false,
//         dontTrack: true,
//       };

//       articles.push(document);
//     }
//   } catch (error) {
//     console.error("Error:", error);
//   }

//   // save the RSS feed core data to the RSS feed table

//   // save each article into the article database with the type "rss-feed-item"

//   // index each article into the vector index database
// }

// // function to regularly check for updates to RSS feeds

// // function to fetch the content of a single RSS feed

// // function to save changes from the RSS feed

// // function to
