const patName = document.querySelector("#pat-name")
const patSecret = document.querySelector("#pat-secret")
const contentUrl = document.querySelector("#contentUrl")
const errorSection = document.querySelector("#errorSection")
const detailsError = document.querySelector("#detailsError")

const userInfo = document.querySelector("#userInfo")
const logoutBtn = document.querySelector("#logout-button")
const userDetails = document.querySelector("#userDetails")
const projectsDiv = document.querySelector("#projectsDiv")
const favoriteLink = document.querySelector("#favoriteLink")
const authenticateDiv = document.querySelector("#authenticate")

const projectsList = document.querySelector("#projectsList")

const populateErrorSection = (text, display="none", color="red") => {
    errorSection.textContent = text
    errorSection.style.display = "block"
    errorSection.style.color = color
}

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

const checkToken = async(array, storageValues, endpoint, token, workbookId = "") => {
    let res = {
        "result": "valid",
        "token": ""
    }

    if(array.error != undefined && array.error.includes("Invalid authentication credentials were provided")) {
        console.log("Refreshing token...")
        populateErrorSection("Refreshing token...", "block")
        const signInResult = await glitchCall(storageValues, "signin");
        
        if (signInResult.error === undefined) {
            let newCall = {
                "siteId": storageValues.siteId,
                "token": signInResult.token
            }

            if(endpoint === "getConnections" || endpoint === "getViews") {
                newCall["workbookId"] = workbookId
                console.log(newCall)
            }

            token = signInResult.token
            await chrome.storage.local.set({
                "token": signInResult.token
            });
            res.result =  await glitchCall(newCall, endpoint, token)
        }

    }
    res.token = token
    return res
}

const logout = () => {
    document.querySelector("h3").classList.toggle("border-animation")
    projectsDiv.style.display = "none"
    userDetails.style.display = "none"
    userInfo.style.display = "none"
    chrome.storage.local.clear()
    location.reload()
}

logoutBtn.addEventListener("click", logout)

document.querySelector("#sync").addEventListener("click", async(e) => {
    e.target.style.animation = "rotateImage 1s linear infinite"

    const previousProjects = await chrome.storage.local.get("projects").then(data => Object.keys(data.projects).length)
    const previousWorkbooks = await chrome.storage.local.get("projects").then(data => {
        let count = 0
        for(let key in data.projects) {
            count += Object.keys(data.projects[key].workbooks).length
        }
        return count
    })

    console.log(`Previous Projects: ${previousProjects}, Previous Workbooks: ${previousWorkbooks}`)

    await fetchUserDetails()

    const newProjects = await chrome.storage.local.get("projects").then(data => Object.keys(data.projects).length)
    const newWorkbooks = await chrome.storage.local.get("projects").then(data => {
        let count = 0
        for(let key in data.projects) {
            count += Object.keys(data.projects[key].workbooks).length
        }
        return count
    })

    let data = ""
    if(newProjects != previousProjects) {
        if(newProjects > previousProjects) data += `${newProjects - previousProjects} new project(s) added \n`
        else data += `${previousProjects - newProjects} old project(s) removed \n`
    }

    if(newWorkbooks != previousWorkbooks) {
        if(newWorkbooks > previousWorkbooks) data += `${newWorkbooks - previousWorkbooks} new workbook(s) added`
        else data += `${previousWorkbooks - newWorkbooks} old workbook(s) removed`
    }

    if(newProjects === previousProjects && newWorkbooks === previousWorkbooks) data = "No changes in the projects"

    chrome.runtime.sendMessage({
        "message": "syncProjects",
        "data": data
    })

    e.target.style.animation = ""
    // location.reload()
})

const loggedInUser = async() => {
    document.querySelector("h3").classList.toggle("border-animation")
    populateErrorSection("")
    const authenticateResult = await glitchCall({
        "personalAccessTokenName": patName.value,
        "personalAccessTokenSecret": patSecret.value,
        "contentUrl": contentUrl.value
    }, "signin")

    if(authenticateResult.error != undefined) {
        populateErrorSection(authenticateResult.error, "block")
    } else {
        populateErrorSection("")
        chrome.storage.local.set({
            "contentUrl": contentUrl.value,
            "token": authenticateResult.token,
            "siteId": authenticateResult.siteId,
            "userId": authenticateResult.userId,
            "personalAccessTokenName": patName.value,
            "personalAccessTokenSecret": patSecret.value
        })

        await fetchUserDetails()
    }
}

const fetchUserDetails = async() => {
    console.log("FURTHER DETAILS FETCHING...")
    document.querySelector("body").style.pointerEvents = "none"

    const storageValues = await chrome.storage.local.get().then(data => data)
    let token = storageValues.token

    // Step 1: Fetching the projects
    let projectsArray = await glitchCall({
        "siteId": storageValues.siteId,
        "token": storageValues.token
    }, "getProjects", token)

    populateErrorSection("Fetching projects...", "block", "green")

    // array, storageValues, endpoint, newCall, token
    let checkTokenResult = await checkToken(projectsArray, storageValues, "getProjects", token)
    token = checkTokenResult.token
    if(checkTokenResult.result != "valid") projectsArray = checkTokenResult.result

    let testProjects = {}
    for(let key in projectsArray) {
        testProjects[projectsArray[key].id] = {
            "name": projectsArray[key].name,
            "id": projectsArray[key].id,
            "description": projectsArray[key].description,
            "workbooks": {},
            "childProject": false,
            "parentProject": "",
            "favorite": false
        }

        // if the project folder is a child project
        if(projectsArray[key].parentProjectId != undefined) {
            testProjects[projectsArray[key].id]["childProject"] = true
            testProjects[projectsArray[key].id]["parentProject"] = projectsArray[key].parentProjectId
        }
    }

    // // Step 2: Fetching the projects
    let workbooksArray = await glitchCall({
        "siteId": storageValues.siteId,
        "token": token
    }, "getWorkbooks", token)

    populateErrorSection("Fetching workbooks...", "block", "green")

    // checking for expired token
    checkTokenResult = await checkToken(workbooksArray, storageValues, "getWorkbooks", token)
    token = checkTokenResult.token
    if(checkTokenResult.result != "valid") workbooksArray = checkTokenResult.result

    populateErrorSection("Fetching connections and views for each workbook...", "block", "green")

    for(let keys in workbooksArray) {
        // adding the workboks to their parent folders
        testProjects[workbooksArray[keys].project.id]["workbooks"][workbooksArray[keys].id] =  {
            "name": workbooksArray[keys].name,
            "size": workbooksArray[keys].size,
            "webpageUrl": workbooksArray[keys].webpageUrl,
            "connections": [],
            "views": {}
        }

        let connectionsArray = await glitchCall({
            "siteId": storageValues.siteId,
            "token": token,
            "workbookId": workbooksArray[keys].id
        }, "getConnections", token)

        // checking for expired token
        checkTokenResult = await checkToken(connectionsArray, storageValues, "getConnections", token, workbooksArray[keys].id)
        token = checkTokenResult.token
        if(checkTokenResult.result != "valid") connectionsArray = checkTokenResult.result

        // adding the data-sources to each of the workbooks
        for(let connection in connectionsArray) {
            testProjects[workbooksArray[keys].project.id]["workbooks"][workbooksArray[keys].id]["connections"].push(connectionsArray[connection].datasource.name)
        }

        let viewsArray = await glitchCall({
            "siteId": storageValues.siteId,
            "token": token,
            "workbookId": workbooksArray[keys].id
        }, "getViews", token)

        // checking for expired token
        checkTokenResult = await checkToken(viewsArray, storageValues, "getViews", token, workbooksArray[keys].id)
        token = checkTokenResult.token
        if(checkTokenResult.result != "valid") viewsArray = checkTokenResult.result

        for(let view in viewsArray) {
            testProjects[workbooksArray[keys].project.id]["workbooks"][workbooksArray[keys].id]["views"][view] = {
                "name": viewsArray[view].name,
                "id": viewsArray[view].id,
                "contentUrl": viewsArray[view].contentUrl,
                "favorite": false
            }

            testProjects[workbooksArray[keys].project.id]["workbooks"][workbooksArray[keys].id]["views"][view]["viewUrl"] = workbooksArray[keys].webpageUrl.replace(/workbooks.*/, `views/${viewsArray[view].contentUrl}`).replace("/sheets", "")
        }
    }

    // updating the projects
    await chrome.storage.local.set({
        "projects": testProjects
    });

    console.log("at the end")
    await populateProjects()

    userInfo.style.display = "block"
    userDetails.style.display = "block"
    projectsDiv.style.display = "block"
    authenticateDiv.style.display = "none"

    document.querySelector("body").style.pointerEvents = "auto"

    logoutBtn.style.display = "block"
};

document.querySelector("#authenticate-button").addEventListener("click", async(e) => {
    if(patName.value === "" || patSecret.value === "" || contentUrl.value === ""){
        populateErrorSection("Please provide PAT values", "block")
        return
    }
    else loggedInUser()
})

const populateFavorites = async() => {
    const storageValues = await chrome.storage.local.get().then(data => data)

    console.log(storageValues.token, storageValues.siteId, storageValues.userId)

    const favorites = await glitchCall({
        "token": storageValues.token,
        "siteId": storageValues.siteId,
        "userId": storageValues.userId
    }, "getFavorites", storageValues.token)

    await chrome.storage.local.set({
        "favorites": favorites
    })

    if(favorites.error == undefined && favorites.length > 0) {
        const projects = await chrome.storage.local.get("projects").then(data => data.projects)
        favorites.forEach(favorite => {
            // if a project is bookmarked
            if(Object.keys(favorite).join(",").includes("project")) {
                projects[favorite.project.id].favorite = true
            }
            // if a view is bookmarked
            else if(Object.keys(favorite).join(",").includes("view")) {
                for(let keys in projects[favorite.view.project.id].workbooks[favorite.view.workbook.id].views) {
                    if(projects[favorite.view.project.id].workbooks[favorite.view.workbook.id].views[keys].id === favorite.view.id) {
                        projects[favorite.view.project.id].workbooks[favorite.view.workbook.id].views[keys].favorite = true
                        return 
                    }
                }
            }
        })

        await chrome.storage.local.set({
            "projects": projects
        })

        // displaying the favorites
        // document.querySelector("#favoritesList").innerHTML = ""

        // let projectsPara = document.createElement("p")
        // projectsPara.style.margin = "5px"
        // projectsPara.style.fontSize = "0.8rem"
        // projectsPara.innerHTML = "<b>Bookmarked projects: </b>"

        // let viewsPara = document.createElement("p")
        // viewsPara.style.margin = "5px"
        // viewsPara.style.fontSize = "0.8rem"
        // viewsPara.innerHTML = "<b>Bookmarked views: </b>"

        // let bookmarkedViews = 0
        // let bookmarkedProjects = 0

        // favorites.forEach(favorite => {
        //     if(Object.keys(favorite).join(",").includes("project")) {
        //         bookmarkedProjects++
        //         projectsPara.innerHTML += favorite[`${Object.keys(favorite)[0]}`].name.length > 20 ? favorite[`${Object.keys(favorite)[0]}`].name.slice(0, 20) + ".." : favorite[`${Object.keys(favorite)[0]}`].name
        //     } else {
        //         bookmarkedViews++
        //         viewsPara.innerHTML += favorite[`${Object.keys(favorite)[0]}`].name.length > 20 ? favorite[`${Object.keys(favorite)[0]}`].name.slice(0, 20) + ".." : favorite[`${Object.keys(favorite)[0]}`].name
        //     }

        //     if(bookmarkedProjects == 0) projectsPara.innerHTML += "NA"
        //     if(bookmarkedViews == 0) viewsPara.innerHTML += "NA"

        //     favoritesList.appendChild(projectsPara)
        //     favoritesList.appendChild(viewsPara)

        //     // let div = document.createElement("div")
        //     // div.style.display = "flex"
        //     // div.style.justifyContent = "space-between"
        //     // div.style.fontSize = "0.7rem"
        //     // div.style.margin = "0 5px"
        //     // div.style.position = "relative"

        //     // let img = document.createElement("img")
        //     // img.width = 60
        //     // img.height = 60

        //     // if(Object.keys(favorite).join(",").includes("project"))
        //     //     img.src = "https://img.icons8.com/bubbles/60/folder-invoices.png"
        //     // else if(Object.keys(favorite).join(",").includes("view"))
        //     //     img.src = "https://img.icons8.com/bubbles/60/books.png"

        //     // div.appendChild(img)

        //     // let innerDiv = document.createElement("div")  
        //     // innerDiv.style.display = "flex"
        //     // innerDiv.style.flexDirection = "column"
        //     // innerDiv.style.justifyContent = "center"
        //     // innerDiv.style.margin = "0"

        //     // let p = document.createElement("p")
        //     // p.style.margin = "0"
        //     // p.style.fontSize = "0.8rem"
        //     // p.style.fontWeight = "bold"
        //     // p.textContent = favorite[`${Object.keys(favorite)[0]}`].name.length > 20 ? favorite[`${Object.keys(favorite)[0]}`].name.slice(0, 20) + ".." : favorite[`${Object.keys(favorite)[0]}`].name
        //     // innerDiv.appendChild(p)

        //     // let innerPara = document.createElement("p")
        //     // innerPara.style.margin = "0"
        //     // innerPara.style.fontSize = "0.7rem"
        //     // innerPara.textContent = favorite[`${Object.keys(favorite)[0]}`].name.length > 20 ? favorite[`${Object.keys(favorite)[0]}`].name.slice(0, 20) + ".." : favorite[`${Object.keys(favorite)[0]}`].name
        //     // innerDiv.appendChild(innerPara)
        //     // div.appendChild(innerDiv)
        //     // favoritesList.appendChild(div)    
        // })

    }
    // else if(favorites.error == undefined && favorites.length == 0) { 
    //     if(document.querySelector("#favoritesList").childNodes[0] && document.querySelector("#favoritesList").childNodes[0].textContent === "No favorites are there") return

    //     const p = document.createElement("p")
    //     p.style.textAlign = "center"
    //     p.style.margin = "0"
    //     p.textContent = "No favorites are there"

    //     favoritesList.appendChild(p)
    // }

    return favorites
}

const expandProject = async (e) => {
    if(e.target.getAttribute("type") === "heartImage") return
    location.href = `details.html?projectId=${e.target.getAttribute("id")}`
}

const favoriteChange = async(e, type="view") => {
    document.querySelector("body").style.pointerEvents = "none"

    const data = await chrome.storage.local.get().then(data => data)
    let currentFavoriteValue = ""
    let endpoint = ""

    if(type == "view") 
        currentFavoriteValue = data.projects[e.target.getAttribute("projectId")].workbooks[e.target.getAttribute("workbookId")].views[e.target.getAttribute("viewId")].favorite

    else if(type == "project") 
        currentFavoriteValue = data.projects[e.target.getAttribute("id")].favorite

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
        if(type == "view" || type == "views") {
            test[e.target.getAttribute("projectId")].workbooks[e.target.getAttribute("workbookId")].views[e.target.getAttribute("viewId")].favorite = !currentFavoriteValue
        } else if(type == "project" || type == "projects") {
            console.log(`Line 355: ${test[e.target.getAttribute("id")].favorite}`)
            test[e.target.getAttribute("id")].favorite = !currentFavoriteValue
        }

        console.log(`Current favorite value: ${!currentFavoriteValue}`)

        await chrome.storage.local.set({
            "projects": test
        })

        // await populateFavorites()

    } else {
        chrome.runtime.sendMessage({
            "message": "favoriteChange",
            "text": favoriteResult.error
        })
    }

    document.querySelector("body").style.pointerEvents = "auto"
}

const populateProjects = async() => {
    await populateFavorites()

    const storageValues = await chrome.storage.local.get().then(data => data)
    const projects = storageValues.projects

    for(let key in projects) {
        // only including the parent projects
        if(projects[key].childProject) continue
        
        // find the child project count for each folder
        let childCount = 0
        let workbookCount = Object.keys(projects[key].workbooks).length
        for(let key2 in projects) {
            if(projects[key2].parentProject === key) {
                childCount++
                workbookCount += Object.keys(projects[key2].workbooks).length
            }
        }

        let div = document.createElement("div")
        div.setAttribute("id", key)
        div.style.display = "flex"
        div.style.justifyContent = "space-around"
        div.style.fontSize = "0.7rem"
        div.style.margin = "0 5px"
        div.style.position = "relative"

        let img = document.createElement("img")
        img.setAttribute("id", key)
        img.width = 60
        img.height = 60
        img.src = "https://img.icons8.com/bubbles/60/folder-invoices.png"

        div.appendChild(img)

        let innerDiv = document.createElement("div")  
        innerDiv.setAttribute("id", key)
        innerDiv.style.display = "flex"
        innerDiv.style.flexDirection = "column"
        innerDiv.style.justifyContent = "center"
        innerDiv.style.margin = "0"

        let p = document.createElement("p")
        p.setAttribute("id", key)
        p.style.margin = "0"
        p.style.fontSize = "0.8rem"
        p.style.fontWeight = "bold"
        p.textContent = projects[key].name.length > 20 ? projects[key].name.slice(0, 20) + ".." : projects[key].name
        innerDiv.appendChild(p)

        // setting some more attributes
        div.setAttribute("childCount", childCount)  
        div.setAttribute("workbookCount", workbookCount)

        let innerPara = document.createElement("p")
        innerPara.setAttribute("id", key)
        innerPara.style.margin = "0"
        innerPara.style.fontSize = "0.7rem"
        innerPara.textContent = `Child Folder: ${childCount} Workbook: ${workbookCount}`
        innerDiv.appendChild(innerPara)

        div.appendChild(innerDiv)

        let heartImage = document.createElement("img")
        heartImage.setAttribute("id", key)
        heartImage.setAttribute("type", "heartImage")
        heartImage.width = "20"
        heartImage.height = "20"
        heartImage.style.top = "5px"
        heartImage.style.right = "0"
        heartImage.style.cursor = "pointer"
        // heartImage.classList.add("heart-img")
        heartImage.style.position = "absolute"
        heartImage.addEventListener("click", (e) => favoriteChange(e, 'project'))

        if(projects[key].favorite) 
            heartImage.src = "https://img.icons8.com/flat-round/20/hearts.png"
        else    
            heartImage.src = "https://img.icons8.com/pastel-glyph/20/hearts--v1.png"

        projectsList.appendChild(div)

        if(workbookCount > 0 || childCount > 0) {
            div.style.cursor = "pointer"
            div.appendChild(heartImage)
            div.addEventListener("click", expandProject)
        } else div.style.cursor = "not-allowed"
    }

    return "Added the DOM elements (projects)"
}

// setting up the favorite link
if(!favoriteLink.getAttribute("href")) {
    const storageValues = await chrome.storage.local.get().then(data => data)

    favoriteLink.setAttribute("href", `https://10ax.online.tableau.com/#/site/${storageValues.contentUrl}/favorites`)
    favoriteLink.addEventListener("click", async(e) => {
        chrome.tabs.create({ url: e.target.getAttribute("href") });
    })
}

await chrome.storage.local.get(["token", "siteId"], async (result) => {
    // user is not logged in
    if(result.token == undefined && result.siteId == undefined) {
        await chrome.storage.local.set({
            "projects": {}
        })
    }
    // user is logged in
    else {
        document.querySelector("h3").classList.add("border-animation")

        authenticateDiv.style.display = "none"

        await populateProjects()

        userInfo.style.display = "block" 
        logoutBtn.style.display = "block"    
        userDetails.style.display = "block"  
        projectsDiv.style.display = "block"
    }
})