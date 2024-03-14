document.querySelector("h3").addEventListener("click", async() => {
    location.href = "popup.html"
})

const views = document.querySelector("#views");
const viewInfo = document.querySelector("#viewInfo");
const viewsFilter = document.querySelector("#viewsFilter");
const projectName = document.querySelector("#projectName");
const projectDescription = document.querySelector("#projectDescription");
const datasourcesList = document.querySelector("#datasourcesList");

const openTab = (url) => {
    chrome.tabs.create({ url });
}

// grabbing the project id from the url
let url = new URL(location.href);
let queryParams = new URLSearchParams(url.search);
let projectId = queryParams.get("projectId");
console.log(projectId);

document.querySelector("#viewsFilter").addEventListener("keyup", (e) => {
    const views =  document.querySelector("#views").childNodes

    if(e.target.value === "") views.forEach(view => view.style.display = "flex");
    else {
        views.forEach(view => {
            if(
                (view.childNodes[1].textContent.split(". ")[1].toLowerCase().includes(e.target.value.toLowerCase())) || 
                (view.childNodes[1].getAttribute("id")).includes(e.target.value.toLowerCase())
            ) {
                view.style.display = "flex";
            } else view.style.display = "none";
        })
    }
})

const glitchCall = async(data, endpoint, token="") => {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    
    const raw = JSON.stringify(data);

    const requestOptions = {
        method: "POST",
        body: raw,
        headers: myHeaders,
        redirect: "follow"
    };

    const result = await fetch(`https://versatile-tableau.glitch.me/${endpoint}`, requestOptions)
    .then((response) => response.json())
    .catch((error) => error);

    return result
}

const favoriteChange = async(e, type="view") => {
    document.querySelector("body").style.pointerEvents = "none"

    const data = await chrome.storage.local.get().then(data => data)
    let currentFavoriteValue = ""
    let endpoint = ""

    if(type == "view") {
        console.log(data.projects)
        console.log(e.target.getAttribute("id"))
        for(let key in data.projects) {
            for(let key1 in data.projects[key].workbooks) {
                for(let key2 in data.projects[key].workbooks[key1].views) {
                    if(data.projects[key].workbooks[key1].views[key2].id == e.target.getAttribute("id")) {
                        currentFavoriteValue = data.projects[key].workbooks[key1].views[key2].favorite
                    }
                }
            
            }
        }
    }

    // setting the endpoint
    endpoint = currentFavoriteValue ? "deleteFavorites" : "addFavorites"

    // deletfavorite requires the type to be plural
    type = currentFavoriteValue ? type+"s" : type

    const favoriteResult = await glitchCall({
        "type": type,
        "typeId": e.target.getAttribute("id"),
        "token": data.token,
        "siteId": data.siteId,
        "userId": data.userId
    }, endpoint, data.token);

    // no error is there
    if(favoriteResult.error == undefined) {
        if(e.target.src == "https://img.icons8.com/flat-round/20/hearts.png")
            e.target.src = "https://img.icons8.com/pastel-glyph/20/hearts--v1.png"
        else 
            e.target.src = "https://img.icons8.com/flat-round/20/hearts.png"

        let test = data.projects

        // setting the favorite value to the new one
        for(let key in test) {
            for(let key1 in test[key].workbooks) {
                for(let key2 in test[key].workbooks[key1].views) {
                    if(test[key].workbooks[key1].views[key2].id == e.target.getAttribute("id")) {
                        test[key].workbooks[key1].views[key2].favorite = !currentFavoriteValue
                    }
                }
            
            }
        }

        console.log(`Current favorite value: ${!currentFavoriteValue}`)

        await chrome.storage.local.set({
            "projects": test
        })

    } else {
        chrome.runtime.sendMessage({
            "message": "favoriteChange",
            "text": favoriteResult.error
        })
    }

    document.querySelector("body").style.pointerEvents = "auto"
}

const embedView = async(e, type="view") => {
    alert(e.target.getAttribute("id")) 
}

await chrome.storage.local.get("projects", (result) => {
    const projectsObject = result.projects;
    
    let viewCount = 0

    for(let project in projectsObject) {

        if((projectsObject[project].id === projectId) || (projectsObject[project].parentProject === projectId)) {
            projectName.textContent = projectsObject[project].name;
            projectDescription.textContent = projectsObject[project].description;

            for(let keys in projectsObject[project]["workbooks"]) {

                for(let connection in projectsObject[project]["workbooks"][keys].connections) {
                    datasourcesList.innerHTML += `<li>${projectsObject[project]["workbooks"][keys].connections[connection]}</li>`;
                }

                for(let view in projectsObject[project]["workbooks"][keys].views) {
                    viewCount++;

                    // add the view in the DOM
                    let div = document.createElement("div");
                    div.style.display = "flex";
                    div.style.flexDirection = "column";
                    div.style.justifyContent = "center";
                    div.style.alignItems = "flex-start";
                    div.style.margin = "15px 10px";
                    div.style.position = "relative";

                    let heartImage = document.createElement("img")
                    heartImage.setAttribute("id", projectsObject[project]["workbooks"][keys].views[view].id)
                    heartImage.setAttribute("type", "heartImage")
                    heartImage.width = "20"
                    heartImage.height = "20"
                    heartImage.style.top = "5px"
                    heartImage.style.right = "0"
                    heartImage.style.cursor = "pointer"
                    // heartImage.classList.add("heart-img")
                    heartImage.style.position = "absolute"
                    heartImage.addEventListener("click", (e) => favoriteChange(e, 'view'))

                    if(projectsObject[project]["workbooks"][keys].views[view].favorite) 
                        heartImage.src = "https://img.icons8.com/flat-round/20/hearts.png"
                    else    
                        heartImage.src = "https://img.icons8.com/pastel-glyph/20/hearts--v1.png"
                    div.appendChild(heartImage)

                    let p = document.createElement("p");
                    p.style.cursor = "pointer";
                    p.style.margin = "0";
                    p.style.fontWeight = "bold";
                    p.setAttribute("id", projectsObject[project]["workbooks"][keys].views[view].id)
                    p.innerHTML = `${viewCount}. <u>${projectsObject[project]["workbooks"][keys].views[view].name}</u>`

                    p.addEventListener("click", () => openTab(projectsObject[project]["workbooks"][keys].views[view]["viewUrl"]))

                    let secondPara = document.createElement("p");
                    secondPara.style.margin = "0";
                    secondPara.style.textAlign = "left";
                    secondPara.style.marginTop = "5px";
                    secondPara.style.cursor = "pointer";
                    secondPara.innerHTML = `<b>Workbook</b>: ${projectsObject[project]["workbooks"][keys].name}`;
                    secondPara.addEventListener("click", () => openTab(projectsObject[project]["workbooks"][keys]["webpageUrl"]))

                    let thirdPara = document.createElement("p");
                    thirdPara.style.margin = "0";
                    thirdPara.style.textAlign = "left";
                    thirdPara.style.cursor = "pointer";
                    thirdPara.innerHTML = `<b>Connections</b>: ${projectsObject[project]["workbooks"][keys].connections.join(", ")}`;
                    thirdPara.addEventListener("click", () => openTab(projectsObject[project]["workbooks"][keys]["webpageUrl"] + "/datasources"))

                    let fourthPara = document.createElement("p");
                    fourthPara.style.margin = "0";
                    fourthPara.textContent = "Direct Child";

                    div.appendChild(p);
                    div.appendChild(secondPara);
                    div.appendChild(thirdPara);

                    if(projectsObject[project].parentProject !== projectId) div.appendChild(fourthPara);

                    views.appendChild(div);

                }
            }
        }
    }

    if(viewCount > 0) 
        viewInfo.innerHTML = `You can see and go to any of the below <b>${viewCount}</b> views for this project`;

    if(viewCount === 0) {
        viewsFilter.style.display = "none";

        datasourcesList.innerHTML = `NA`;

        let p = document.createElement("p");
        p.style.margin = "5px";
        p.style.textAlign = "justify";
        p.innerHTML = "Either the views are <u>deeper in the hierarchy</u> or there are <u>no views</u> in this project. \n Create a view and then try again";

        views.appendChild(p);
    } else {
        viewsFilter.style.display = "block";
    }

})