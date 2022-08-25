(function () {
  const cx = {};
  function suggest(addresses) {
    clearSuggest();
    cx.currentFocus = -1;
    cx.addressDivs = addresses.map((address) => {
      const b = appendDiv(cx.autocompleteItems, undefined, address.formatData);
      b.addEventListener("click", () => addressSelected(address));
      return b;
    });
  }
  function clearSuggest() {
    cx.autocompleteItems.innerHTML = "";
    cx.addressDivs = undefined;
  }
  function moveFocus(move) {
    cx.currentFocus =
      (cx.currentFocus + move + cx.addressDivs.length) % cx.addressDivs.length;
    cx.addressDivs.forEach((d, i) => {
      if (i === cx.currentFocus) d.classList.add("autocomplete-active");
      else d.classList.remove("autocomplete-active");
    });
  }
  let map;
  let addressMarker;
  let selectedSchoolMarker;
  function icon(col) {
    return new L.Icon({
      iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${col}.png`,
      shadowUrl:
        "https://unpkg.com/leaflet@1.8.0/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });
  }
  const iconBlue = icon("blue");
  const iconRed = icon("red");
  const iconGold = icon("gold");
  const timesIcon = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="18" height="18" viewBox="0 0 24 24"><path d="M 3 3 L 21 21 M 3 21 L 21 3" stroke="var(--primary)" stroke-linecap="round" stroke-width="4"></svg>`;
  const caretIcon = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="14" height="14" viewBox="0 0 24 24"><path d="M 4 5 L 12 19 L 20 5" stroke="var(--primary)" stroke-linecap="round" stroke-linejoin="round" stroke-width="4" fill="none"></svg>`;
  function addressSelected(address) {
    cx.input.value = address.formatData;
    showResults(true);
    showMap(true);
    const center = [address.lat, address.lon];
    map.setView(center, 15);
    if (!addressMarker) addressMarker = L.marker(center, { icon: iconRed });
    addressMarker.setLatLng(center);
    markerTooltip(addressMarker, address.formatData);
    addressMarker.addTo(map);
    clearSuggest();
    cx.lookupPromise.then(() => {
      apiGet("/StudyAreaPrograms?studyArea=" + address.studyAreaId).then(
        onBoundaryData
      );
    });
  }
  function showAllSchools() {
    const bounds = cx.allSchoolsGroup.getBounds().pad(0.1);
    cx.allSchoolsGroup.addTo(map);
    map.fitBounds(bounds);
  }
  function hideAllSchools() {
    cx.allSchoolsGroup.remove();
  }
  function showResults(visible) {
    cx.schoolsDiv.style.display = visible ? "block" : "none";
    if (!visible && !!addressMarker) {
      addressMarker.remove();
    }
  }
  function showMap(visible) {
    cx.mapDiv.style.visibility = visible ? "visible" : "hidden";
  }
  function schoolSelected(dispSchool) {
    var _a;
    if (cx.selectedSchool === dispSchool) dispSchool = undefined;
    cx.selectedSchool = dispSchool;
    (_a = cx.dispPrograms) === null || _a === void 0
      ? void 0
      : _a.forEach((dispProgram) => {
          dispProgram.dispSchools.forEach((ds) => {
            ds.div.style.backgroundColor =
              ds.programsDiv.style.backgroundColor =
                dispSchool === ds ? "#f6f7f8" : "#fff";
            ds.div.style.borderLeftColor =
              dispSchool === ds
                ? "#ffd326"
                : "var(--primary, --primary-default)";
            ds.programsDiv.style.display = dispSchool === ds ? "block" : "none";
          });
        });
    if (selectedSchoolMarker) selectedSchoolMarker.remove();
    if (dispSchool) {
      selectedSchoolMarker = L.marker(
        [dispSchool.school.lat, dispSchool.school.long],
        { icon: iconGold }
      );
      markerTooltip(selectedSchoolMarker, dispSchool.school.name);
      selectedSchoolMarker.addTo(map);
      if (!dispSchool.attributesDiv) {
        getSchoolAttributes(dispSchool.school).then((schAttrValues) => {
          dispSchool.school.attributes = schAttrValues;
          dispSchool.attributesDiv = buildSchoolAttributes(dispSchool.school);
          dispSchool.programsDiv.appendChild(dispSchool.attributesDiv);
        });
      }
    }
  }
  function buildSchoolPrograms(div, dispSchool) {
    cx.dispPrograms.forEach((dispProgram) => {
      const oo = dispProgram.dispSchools.find(
        (ds) => ds.school == dispSchool.school
      );
      if (oo) {
        appendDiv(div, "program-name", dispProgram.program.programTypeName);
        appendDiv(
          div,
          "grades-list",
          `Grades: ${oo.grades.map((g) => g.gradeName).join(", ")}`
        );
      }
    });
  }
  function getSchoolAttributes(school) {
    return school.attributes
      ? Promise.resolve(school.attributes)
      : apiGet("/data/" + school.id + ".json");
  }
  function buildSchoolAttributes(school) {
    const attributesDiv = document.createElement("div");
    attributesDiv.className = "school-attributes";
    cx.schoolAttributes.forEach((schAttr) => {
      const attrValues = school.attributes.filter(
        (av) => av.schAttrId === schAttr.attrId
      );
      attrValues.forEach((attrValue) => {
        if (attrValue.attrValue && schAttr.attrName) {
          const attrDiv = appendDiv(attributesDiv, "attribute");
          append(attrDiv, "span", "attribute-name", schAttr.attrName + ":");
          append(attrDiv, "span", "attribute-value", attrValue.attrValue);
        }
      });
    });
    return attributesDiv;
  }
  function buildSchoolsList() {
    const container = getTagElement("easyaddress-schools");
    if (container) {
      if (cx.primaryColor)
        container.style.setProperty("--primary", cx.primaryColor);
      const div = appendDiv(container, "all-schools");
      const ddlDiv = appendDiv(div, "school-filters");
      const table = document.createElement("table");
      div.appendChild(table);
      const thead = document.createElement("thead");
      const row = document.createElement("tr");
      thead.appendChild(row);
      append(row, "th", "", "School");
      append(row, "th", "", "Municipality");
      table.appendChild(thead);
      const tbody = document.createElement("tbody");
      table.appendChild(tbody);
      function addOption(ddl, value, text) {
        const option = document.createElement("option");
        option.value = value;
        option.text = text;
        ddl.appendChild(option);
      }
      buildSchoolsTable(tbody);
    }
  }
  function buildSchoolsTable(tbody) {
    tbody.innerHTML = "";
    cx.schools
      .filter((school) => {
        const progMatch =
          !cx.selectedProgram ||
          school.programTypeIds.includes(cx.selectedProgram);
        const municipalityMatch =
          !cx.selectedMunicipality ||
          school.municipalityId === cx.selectedMunicipality;
        return progMatch && municipalityMatch;
      })
      .forEach((school) => {
        var _a;
        const row = document.createElement("tr");
        function addCell(s) {
          const cell = document.createElement("td");
          if (s) cell.innerText = s;
          row.appendChild(cell);
          return cell;
        }
        const nameCell = addCell();
        const nameDiv = appendDiv(nameCell);
        append(nameDiv, "span", "caret").innerHTML = caretIcon;
        append(nameDiv, "span", "school-name", school.name);
        const expandDiv = appendDiv(nameCell);
        const programs = cx.programs
          .filter((p) => school.programTypeIds.includes(p.id))
          .map((p) => p.programTypeName);
        appendDiv(expandDiv, "school-programs", programs.join(", "));
        const attributesDiv = appendDiv(expandDiv, "school-attributes");
        expandDiv.style.display = "none";
        addCell(
          ((_a = cx.municipalities.find(
            (m) => m.id === school.municipalityId
          )) === null || _a === void 0
            ? void 0
            : _a.name) || ""
        );
        tbody.appendChild(row);
        row.className = "school-row";
        row.addEventListener("click", () => {
          const show = nameCell.className !== "expanded";
          expandDiv.style.display = show ? "block" : "none";
          nameCell.className = show ? "expanded" : "";
          if (show && attributesDiv.innerHTML === "") {
            getSchoolAttributes(school).then((schAttrValues) => {
              school.attributes = schAttrValues;
              attributesDiv.appendChild(buildSchoolAttributes(school));
            });
          }
        });
      });
  }
  function zoomOnSchools() {
    const bounds = L.featureGroup([addressMarker, ...cx.schoolMarkers])
      .getBounds()
      .pad(0.1);
    map.fitBounds(bounds);
  }
  function onBoundaryData(bds) {
    hideAllSchools();
    const schoolDic = toDic(cx.schools);
    const programDic = toDic(cx.programs);
    const gradeDic = toDic(cx.grades);
    if (cx.schoolMarkers) cx.schoolMarkers.forEach((m) => m.remove());
    cx.schoolMarkers = [];
    const dispProgramDic = {};
    bds.forEach((bd) => {
      if (!(bd.programTypeId in dispProgramDic))
        dispProgramDic[bd.programTypeId] = {
          program: programDic[bd.programTypeId],
          dispSchoolDic: {},
        };
      const dispProgram = dispProgramDic[bd.programTypeId];
      if (!(bd.schoolId in dispProgram.dispSchoolDic)) {
        const school = schoolDic[bd.schoolId];
        if (!school) console.error(`School ${bd.schoolId} not found`);
        else {
          const marker = L.marker([school.lat, school.long], {
            icon: iconBlue,
          });
          dispProgram.dispSchoolDic[bd.schoolId] = {
            school,
            marker,
            grades: [],
          };
          markerTooltip(marker, school.name);
          cx.schoolMarkers.push(marker);
          marker.addTo(map);
        }
      }
      const dispSchool = dispProgram.dispSchoolDic[bd.schoolId];
      if (!(bd.gradeId in gradeDic))
        console.error(`Grade ${bd.gradeId} not found`);
      else dispSchool.grades.push(gradeDic[bd.gradeId]);
    });
    cx.dispPrograms = values(dispProgramDic).sort(
      (a, b) => a.program.sortOrder - b.program.sortOrder
    );
    cx.dispPrograms.forEach((dispProgram) => {
      dispProgram.dispSchools = values(dispProgram.dispSchoolDic);
      dispProgram.dispSchools.forEach((dispSchool) => {
        dispSchool.grades.sort((a, b) => a.gradeOrder - b.gradeOrder);
        dispSchool.gradeRange = dispSchool.grades[0].gradeName;
        if (dispSchool.grades.length > 1)
          dispSchool.gradeRange += `-${
            dispSchool.grades[dispSchool.grades.length - 1].gradeName
          }`;
      });
      dispProgram.dispSchools.sort((a, b) => {
        const c = a.grades[0].gradeOrder;
        const d = b.grades[0].gradeOrder;
        if (c !== d) return c - d;
        return a.school.name < b.school.name ? -1 : 1;
      });
    });
    cx.schoolListDiv.innerHTML = "";
    cx.dispPrograms.forEach((dispProgram) => {
      const programDiv = appendDiv(cx.schoolListDiv, "program-schools");
      appendDiv(
        programDiv,
        "program-name",
        dispProgram.program.programTypeName
      );
      dispProgram.dispSchools.forEach((dispSchool) => {
        const schoolDiv = appendDiv(programDiv, "school");
        schoolDiv.addEventListener("click", () => schoolSelected(dispSchool));
        dispSchool.div = schoolDiv;
        appendDiv(schoolDiv, "grades", dispSchool.gradeRange);
        const detailsDiv = appendDiv(schoolDiv, "details");
        const nameAddressDiv = appendDiv(detailsDiv, "name-address");
        appendDiv(nameAddressDiv, "school-name", dispSchool.school.name);
        appendDiv(nameAddressDiv, "school-address", dispSchool.school.city);
        dispSchool.programsDiv = appendDiv(programDiv, "school-programs");
        buildSchoolPrograms(dispSchool.programsDiv, dispSchool);
      });
    });
    zoomOnSchools();
  }
  function markerTooltip(marker, text, permanent = false) {
    const span = document.createElement("span");
    span.innerText = text;
    marker.bindTooltip(span, {
      direction: "top",
      permanent,
      interactive: !permanent,
      className: "school-tooltip",
      offset: [0, -32],
    });
  }
  function append(parent, tagName, className, text) {
    const tag = document.createElement(tagName);
    tag.className = className;
    if (text) tag.innerText = text;
    parent.appendChild(tag);
    return tag;
  }
  function appendDiv(parent, className, text) {
    return append(parent, "div", className, text);
  }
  function searchKeyDown(e) {
    if (["ArrowUp", "ArrowDown", "Enter"].includes(e.key)) return;
    if (cx.input.value.length > 3) {
      const path =
        "/SearchAddress?filterText=" + encodeURIComponent(cx.input.value);
      apiGet(path).then((addresses) => {
        showResults(false);
        showMap(false);
        suggest(addresses);
      });
    }
  }
  function apiGet(path) {
    return new Promise((resolve, reject) => {
      const url = window.location.origin + path;
      //  console.log(path);
      const request = new XMLHttpRequest();
      request.open("GET", url, true);
      request.withCredentials = true;
      request.setRequestHeader("Authorization", cx.apiKey);
      request.send();
      request.onload = () => {
        const response = JSON.parse(request.response);
        resolve(response);
      };
      request.onerror = () => reject();
    });
  }
  function onContentLoaded() {
    if (buildMarkup()) {
      cx.resultDiv.classList.add("loading");
      cx.lookupPromise = apiGet("/GetLookup.json");
      cx.lookupPromise.then((r) => {
        cx.resultDiv.classList.remove("loading");
        cx.districtId = r.districtId;
        cx.programs = r.programs;
        cx.grades = r.grades;
        cx.municipalities = r.municipalities;
        cx.schools = r.schools.sort((a, b) => (a.name < b.name ? -1 : 1));
        cx.schoolAttributes = r.schoolAttributes;
        const allMarkers = cx.schools
          .filter((school) => !!school.lat && school.long)
          .map((school) => {
            const marker = L.marker([school.lat, school.long], {
              icon: iconBlue,
            });
            markerTooltip(marker, school.name);
            return marker;
          });
        cx.allSchoolsGroup = L.featureGroup(allMarkers);
        showAllSchools();
        buildSchoolsList();
      });
    }
  }
  function getTagElement(tagName) {
    const containers = document.getElementsByTagName(tagName);
    if (containers.length > 0) return containers[0];
  }
  function buildMarkup() {
    const tagName = "easyaddress-search";
    const container = getTagElement(tagName);
    if (!container) {
      console.error(`Expected tag <${tagName}> not found`);
      return false;
    }
    cx.apiKey = container.getAttribute("api-key");
    cx.bingMapsKey = container.getAttribute("bing-maps-key");
    cx.primaryColor = container.getAttribute("primary-color");
    if (cx.primaryColor)
      container.style.setProperty("--primary", cx.primaryColor);
    cx.autocompleteDiv = appendDiv(container, "autocomplete");
    cx.input = document.createElement("input");
    cx.input.name = "q";
    cx.input.type = "text";
    cx.input.placeholder = "Address search...";
    cx.input.spellcheck = false;
    cx.input.addEventListener(
      "keyup",
      () =>
        (cx.clearDiv.style.display =
          cx.input.value.length > 0 ? "flex" : "none")
    );
    cx.input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        moveFocus(1);
      } else if (e.key === "ArrowUp") {
        moveFocus(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (cx.currentFocus > -1) {
          cx.addressDivs[cx.currentFocus].click();
        }
      }
    });
    cx.autocompleteDiv.appendChild(cx.input);
    cx.clearDiv = appendDiv(cx.autocompleteDiv, "clear-input");
    cx.clearDiv.innerHTML = timesIcon;
    cx.clearDiv.addEventListener("click", () => {
      cx.input.value = "";
      cx.clearDiv.style.display = "none";
      clearSuggest();
      schoolSelected();
      cx.schoolListDiv.innerHTML = "";
      showResults(false);
      showAllSchools();
      cx.input.focus();
    });
    cx.autocompleteItems = appendDiv(cx.autocompleteDiv, "autocomplete-items");
    cx.resultDiv = appendDiv(container, "result");
    cx.schoolsDiv = appendDiv(cx.resultDiv, "schools");
    cx.schoolListDiv = appendDiv(cx.schoolsDiv, "school-list");
    cx.mapDiv = appendDiv(cx.resultDiv, "map");
    map = L.map(cx.mapDiv);
    map.gestureHandling.enable();
    if (cx.bingMapsKey) {
      var canvasLayer = L.tileLayer.bing({
        bingMapsKey: cx.bingMapsKey,
        imagerySet: "CanvasGray",
      });
      var aerialLayer = L.tileLayer.bing({
        bingMapsKey: cx.bingMapsKey,
        imagerySet: "AerialWithLabelsOnDemand",
      });
      canvasLayer.addTo(map);
      L.control.layers({ Canvas: canvasLayer, Aerial: aerialLayer }).addTo(map);
    } else {
      L.tileLayer(
        "https://tile.geofabrik.de/6558165727eb4dcb82791cbd346ce310/{z}/{x}/{y}.png",
        { maxZoom: 18, attribution: "OSM" }
      ).addTo(map);
    }
    const mapResizeObserver = new ResizeObserver((_entries) => {
      map.invalidateSize();
    });
    mapResizeObserver.observe(cx.mapDiv);
    const debounce = (func, wait) => {
      let debounceTimer;
      return function () {
        const context = this;
        const args = arguments;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(context, args), wait);
      };
    };
    cx.input.addEventListener("keyup", debounce(searchKeyDown, 300));
    return true;
  }
  document.addEventListener("DOMContentLoaded", onContentLoaded, {
    passive: true,
    once: true,
  });
  function toDic(ts) {
    const dic = {};
    ts.forEach((t) => (dic[t.id] = t));
    return dic;
  }
  function values(tDic) {
    return Object.keys(tDic)
      .map(Number)
      .map((id) => tDic[id]);
  }
})();
//# sourceMappingURL=easyaddress-search.js.map
