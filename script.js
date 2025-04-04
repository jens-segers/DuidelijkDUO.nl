document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM is loaded and custom Script is running");

    var body = document.body;
    var chartCanvas = document.getElementById('myChart');
    var dataTypeSelect = document.getElementById('dataTypeSelect');
    var locationSelect = document.getElementById('locationSelect');
    var educationSelect = document.getElementById('educationSelect');
    var yearSelect = document.getElementById('yearSelect');
    var schoolSelect = document.getElementById('schoolSelect'); // New school select element
    var mapElement = document.getElementById('map'); // Map element

    const fullscreenButton = document.querySelector('.fullscreen-button');
    const lightDarkToggle = document.querySelector('.light-dark-toggle');
    const chartTitle = document.getElementById('chartTitle');

    let jsonData;
    let myChart;
    let map; // Leaflet map instance
    let rateLimitWarningShown = false; // Flag to ensure the warning is shown only once
    let geoRefData; // Variable to store the georef JSON data

    // Laad de JSON data
    fetch('data/duo_ingeschrevenhbo_2024.json')
        .then(response => response.json())
        .then(data => {
            jsonData = data.map(entry => {
                // Convert properties whose name looks like a year (four digits) and value is a string to a number.
                // This sets values like "<5" to 0.
                for (const [key, value] of Object.entries(entry)) {
                    if (key.match(/^\d{4}$/) && typeof value === 'string') {
                        entry[key] = parseInt(value) || 0;
                    }
                }
                return entry;
            });
            populateFilterOptions(); // Dynamically populate filter options
            loadChart('map'); // Set the map as the default chart
        });

    // Load the georef JSON data
    fetch('data/nederland_gemeenten_centroids.json') // Updated file path
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            geoRefData = data; // Store the georef data
        })
        .catch(error => {
            console.error("Failed to load georef data:", error);
        });

    function populateFilterOptions() {
        const locations = {
            Provincie: new Set(),
            Gemeente: new Set(),
            Scholen: new Set(), // Add a new category for schools
        };
        const educations = {
            Opleiding: new Set()
        };
        const years = {
            Jaar: new Set()
        };

        jsonData.forEach(entry => {
            if (entry['PROVINCIE']) locations.Provincie.add(entry['PROVINCIE']);
            if (entry['GEMEENTENAAM'] && entry['GEMEENTENAAM'].trim() !== '') locations.Gemeente.add(entry['GEMEENTENAAM']); // Ensure valid municipalities
            if (entry['INSTELLINGSNAAM ACTUEEL']) locations.Scholen.add(entry['INSTELLINGSNAAM ACTUEEL']); // Add schools to the Scholen category
            if (entry['OPLEIDINGSNAAM ACTUEEL']) educations.Opleiding.add(entry['OPLEIDINGSNAAM ACTUEEL']);
            for (const [key, value] of Object.entries(entry)) {
                if (key.match(/^\d{4}$/)) years.Jaar.add(key);
            }
        });

        // Populate the dropdowns
        updateLocationAndEducationOptions();
        populateSelectList(years, yearSelect);
        toggleVisibility();
    }

    function updateLocationAndEducationOptions() {
        const selectedLocation = locationSelect.value;
        const selectedSchool = schoolSelect.value;
        const selectedEducation = educationSelect.value;

        const filteredLocations = {
            Provincie: new Set(),
            Gemeente: new Set(),
        };
        const filteredSchools = new Set();
        const filteredEducations = new Set();
        const filteredYears = new Set();

        jsonData.forEach(entry => {
            const matchesLocation = !selectedLocation || 
                entry['PROVINCIE'] === selectedLocation || 
                entry['GEMEENTENAAM'] === selectedLocation;

            const matchesSchool = !selectedSchool || 
                entry['INSTELLINGSNAAM ACTUEEL'] === selectedSchool;

            const matchesEducation = !selectedEducation || 
                entry['OPLEIDINGSNAAM ACTUEEL'] === selectedEducation;

            // Ensure schools are filtered based on the selected location
            if (matchesLocation && matchesEducation) {
                if (entry['INSTELLINGSNAAM ACTUEEL']) filteredSchools.add(entry['INSTELLINGSNAAM ACTUEEL']);
            }

            // Populate locations if school and education match
            if (matchesSchool && matchesEducation) {
                if (entry['PROVINCIE']) filteredLocations.Provincie.add(entry['PROVINCIE']);
                if (entry['GEMEENTENAAM'] && entry['GEMEENTENAAM'].trim() !== '') filteredLocations.Gemeente.add(entry['GEMEENTENAAM']);
            }

            // Populate educations if location and school match
            if (matchesLocation && matchesSchool) {
                if (entry['OPLEIDINGSNAAM ACTUEEL']) filteredEducations.add(entry['OPLEIDINGSNAAM ACTUEEL']);
            }

            // Populate years if location, school, and education match
            if (matchesLocation && matchesSchool && matchesEducation) {
                Object.keys(entry).forEach(key => {
                    if (key.match(/^\d{4}$/) && entry[key] > 0) filteredYears.add(key); // Only include years with data
                });
            }
        });

        // Repopulate the dropdowns with filtered options
        populateSelectList(filteredLocations, locationSelect, "Alle locaties");
        populateSelectList({ Scholen: filteredSchools }, schoolSelect, "Alle scholen");
        populateSelectList({ Opleiding: filteredEducations }, educationSelect, "Alle opleidingen");
        populateSelectList({ Jaar: filteredYears }, yearSelect);

        // Restore previously selected options if they are still valid
        if (!filteredLocations.Provincie.has(selectedLocation) && !filteredLocations.Gemeente.has(selectedLocation)) {
            locationSelect.value = '';
        } else {
            locationSelect.value = selectedLocation;
        }

        if (!filteredSchools.has(selectedSchool)) {
            schoolSelect.value = '';
        } else {
            schoolSelect.value = selectedSchool;
        }

        if (!filteredEducations.has(selectedEducation)) {
            educationSelect.value = '';
        } else {
            educationSelect.value = selectedEducation;
        }

        if (!filteredYears.has(yearSelect.value)) {
            yearSelect.value = '';
        }

        // Refresh the chart after filtering
        loadChart(dataTypeSelect.value);
    }

    function toggleVisibility() {
        const isMap = dataTypeSelect.value === 'map';
        const isTotalCount = dataTypeSelect.value === 'totalCount';
        yearSelect.classList.toggle('hidden', isTotalCount); // Hide yearSelect for "Aantal studenten"
        locationSelect.classList.toggle('hidden', isMap);
        schoolSelect.classList.toggle('hidden', isMap);
        educationSelect.classList.toggle('hidden', isMap);
        mapElement.classList.toggle('hidden', !isMap);
        chartCanvas.classList.toggle('hidden', isMap);
    }

    /*
     * Populate a select list with options from a data object.
     * The data is a map with keys as group names and values as arrays of options.
     * For each key an option group is added to the select list.
     * The selectList is a select element to populate with the data.
     */
    function populateSelectList(data, selectList, noneOption) {
        selectList.innerHTML = ''; // Clear existing options
        if (noneOption !== undefined) {
            // Add an option to select "Alle ..."
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = noneOption;
            selectList.appendChild(opt);
        }

        for (const [group, options] of Object.entries(data)) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = group;
            selectList.appendChild(optgroup);

            Array.from(options)
                .sort((a, b) => a.localeCompare(b))
                .forEach(option => {
                    const opt = document.createElement('option');
                    opt.value = option;
                    opt.textContent = option;
                    optgroup.appendChild(opt);
                });
        }
    }

    function updateChartTitle(text) {
        const words = text.split(" ");
        const midIndex = Math.ceil(words.length / 2);
        const firstLine = words.slice(0, midIndex).join(" ");
        const secondLine = words.slice(midIndex).join(" ");
        chartTitle.innerHTML = `${firstLine}<br>${secondLine}`; // Add a line break for even distribution
    }

    function loadChart(type) {
        if (myChart) myChart.destroy();
        if (map) {
            map.remove(); // Remove the map if it exists
            map = null;
        }

        // Determine the chart title based on selected filters
        const location = locationSelect.value || "alle locaties";
        const school = schoolSelect.value || "alle scholen";
        const education = educationSelect.value || "alle opleidingen";
        const year = yearSelect.value || "alle jaren";

        let titleText;
        switch (type) {
            case 'genderDistribution':
                if (education === "alle opleidingen") {
                    titleText = `Geslachtsverdeling in ${location} bij ${school} (${year})`;
                } else {
                    titleText = `Geslachtsverdeling in ${location} bij ${school} voor opleiding "${education}" (${year})`;
                }
                createGenderDistributionChart(locationSelect.value, schoolSelect.value, educationSelect.value, yearSelect.value);
                break;
            case 'totalCount':
                if (education === "alle opleidingen") {
                    titleText = `Aantal studenten in ${location} bij ${school}`;
                } else {
                    titleText = `Aantal studenten in ${location} bij ${school} voor opleiding "${education}"`;
                }
                createTotalCountChart(locationSelect.value, schoolSelect.value, educationSelect.value);
                break;
            case 'map':
                titleText = `Kaartweergave per gemeente met weergave van het aantal studenten en de geslachtsverdeling (${year})`;
                createMap(locationSelect.value, schoolSelect.value, educationSelect.value, yearSelect.value);
                break;
            default:
                titleText = 'Onbekende grafiek';
                console.log('Unknown chart type');
        }

        updateChartTitle(titleText); // Update the title with even word distribution
    }

    function filterData(location, school, education, year) {
        return jsonData
            .filter(entry => {
                const isLocationMatch = !location || 
                    entry['PROVINCIE'] === location || 
                    entry['GEMEENTENAAM'] === location;
                const isSchoolMatch = !school || entry['INSTELLINGSNAAM ACTUEEL'] === school;
                const isEducationMatch = !education || entry['OPLEIDINGSNAAM ACTUEEL'] === education;
                return isLocationMatch && isSchoolMatch && isEducationMatch;
            })
            // Remove year properties that are not equal to the selected year
            .map(entry => {
                if (year) {
                    const newEntry = { ...entry };
                    for (const key of Object.keys(entry)) {
                        if (!key.match(/^\d{4}$/) || key === year) continue;
                        delete newEntry[key];
                    }
                    return newEntry;
                }
                return entry;
            });
    }

    function createGenderDistributionChart(location, school, education, year) {
        // Filter de data op basis van locatie, school, opleiding en jaar
        const filteredData = filterData(location, school, education, year);

        // Bereken het aantal mannen en vrouwen
        const genderCounts = filteredData.reduce((acc, entry) => {
            const yearValue = year ? entry[year] : 1; // Use the year value if provided, otherwise count as 1
            if (entry.GESLACHT) {
                acc[entry.GESLACHT] = (acc[entry.GESLACHT] || 0) + yearValue;
            }
            return acc;
        }, {});

        const total = (genderCounts['man'] || 0) + (genderCounts['vrouw'] || 0);
        const malePercentage = total > 0 ? ((genderCounts['man'] || 0) / total * 100).toFixed(1) : 0; // Percentage mannen
        const femalePercentage = total > 0 ? ((genderCounts['vrouw'] || 0) / total * 100).toFixed(1) : 0; // Percentage vrouwen

        // Maak de cirkeldiagram
        myChart = new Chart(chartCanvas, {
            type: 'pie',
            data: {
                labels: ['Man', 'Vrouw'],
                datasets: [{
                    label: 'Geslachtsverdeling',
                    data: [genderCounts['man'] || 0, genderCounts['vrouw'] || 0],
                    backgroundColor: ['rgba(54, 162, 235, 0.4)', 'rgba(255, 99, 132, 0.4)'],
                    borderColor: ['rgb(54, 162, 235)', 'rgb(255, 99, 132)'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#FFFFFF'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const value = context.raw;
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                // Format numbers with dots as thousand separators
                                return `${context.label}: ${value.toLocaleString('nl-NL')} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    function createTotalCountChart(location, school, education) {
        const total = {};
        const growthRates = [];

        // Filter de data op basis van locatie, school en opleiding
        var filteredData = filterData(location, school, education);

        // Verzamel het totale aantal studenten per jaar
        filteredData.forEach(entry => {
            for (const [key, value] of Object.entries(entry)) {
                if (key.match(/^\d{4}$/)) {
                    total[key] = (total[key] || 0) + value;
                }
            }
        });

        // Bereken de procentuele groei of afname per jaar
        const years = Object.keys(total).sort(); // Sorteer de jaren op volgorde
        for (let i = 1; i < years.length; i++) {
            const currentYear = years[i];
            const previousYear = years[i - 1];
            const growthRate = ((total[currentYear] - total[previousYear]) / total[previousYear]) * 100;
            growthRates.push(growthRate.toFixed(1)); // Rond af op 1 decimaal
        }

        // Maak de grafiek
        myChart = new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels: years,
                datasets: [
                    {
                        label: 'Totaal aantal studenten',
                        data: Object.values(total),
                        backgroundColor: 'rgba(255, 255, 255, 0.4)',
                        borderColor: 'rgb(255, 255, 255)',
                        borderWidth: 1,
                        tension: 0.1 // Smooth the line
                    },
                    {
                        label: 'Procentuele groei/afname',
                        data: [null, ...growthRates], // Voeg null toe voor het eerste jaar (geen groei)
                        backgroundColor: 'rgba(54, 162, 235, 0.4)',
                        borderColor: 'rgb(54, 162, 235)',
                        borderWidth: 1,
                        tension: 0.1, // Smooth the line
                        yAxisID: 'y2' // Gebruik een tweede Y-as
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#FFFFFF'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const datasetLabel = context.dataset.label || '';
                                const value = context.raw;
                                if (context.dataset.yAxisID === 'y2') {
                                    // Voeg een procentteken toe voor de procentuele groei/afname
                                    return `${datasetLabel}: ${value}%`;
                                }
                                // Format numbers with dots as thousand separators
                                return `${datasetLabel}: ${value.toLocaleString('nl-NL')}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#FFFFFF'
                        },
                        grid: {
                            color: '#FFFFFF'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#FFFFFF',
                            callback: function (value) {
                                // Format numbers with dots as thousand separators
                                return value.toLocaleString('nl-NL');
                            }
                        },
                        grid: {
                            color: '#FFFFFF'
                        }
                    },
                    y2: {
                        position: 'right', // Plaats de tweede Y-as aan de rechterkant
                        ticks: {
                            color: '#36A2EB',
                            callback: function (value) {
                                return value + '%'; // Voeg een procentteken toe aan de labels
                            }
                        },
                        grid: {
                            drawOnChartArea: false // Verberg de gridlijnen van de tweede Y-as
                        }
                    }
                }
            }
        });
    }

    function getCoordinatesFromGeoRef(city, province) {
        if (!geoRefData || geoRefData.length === 0) {
            console.warn("Georef data not loaded yet or is empty.");
            return null;
        }

        if (!city || !province) {
            console.warn("City or province is undefined or null.");
            return null;
        }

        const match = geoRefData.find(entry => 
            entry.city.some(c => c.toLowerCase().trim() === city.toLowerCase().trim()) &&
            entry.province.toLowerCase().trim() === province.toLowerCase().trim()
        );

        if (match) {
            return [match.lat, match.lon];
        } else {
            console.warn(`Coordinates for ${city}, ${province} not found in georef data.`);
            return null;
        }
    }

    function createMap(location, school, education, year) {
        const filteredData = filterData(location, school, education, year);

        // Aggregate student counts by city and province
        const studentCounts = {};
        filteredData.forEach(entry => {
            const city = entry['GEMEENTENAAM']?.trim() || 'Onbekend'; // Ensure valid city names
            const province = entry['PROVINCIE']?.trim() || 'Onbekend'; // Ensure valid province names
            const key = `${city}, ${province}`;
            const count = year ? entry[year] || 0 : 1;

            if (!studentCounts[key]) {
                studentCounts[key] = { total: 0, male: 0, female: 0 };
            }

            studentCounts[key].total += count;
            if (entry.GESLACHT === 'man') {
                studentCounts[key].male += count;
            } else if (entry.GESLACHT === 'vrouw') {
                studentCounts[key].female += count;
            }
        });

        // Determine the map tile layer based on the current theme
        const isDarkMode = document.body.classList.contains('dark-mode');
        const tileLayerUrl = isDarkMode
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        const tileLayerAttribution = isDarkMode
            ? '&copy; <a href="https://carto.com/">CARTO</a> contributors'
            : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

        // Initialize the map
        if (map) {
            map.remove(); // Remove the existing map instance
        }
        map = L.map('map').setView([52.1, 5.2], 7); // Centered on the Netherlands
        L.tileLayer(tileLayerUrl, {
            attribution: tileLayerAttribution
        }).addTo(map);

        // Add markers for each city/province
        Object.entries(studentCounts).forEach(([location, counts]) => {
            const [city, province] = location.split(', ');
            if (city !== 'Onbekend' && province !== 'Onbekend') {
                const coordinates = getCoordinatesFromGeoRef(city, province);
                if (coordinates) {
                    const total = counts.total;
                    const male = counts.male;
                    const female = counts.female;
                    const malePercentage = total > 0 ? ((male / total) * 100).toFixed(1) : 0;
                    const femalePercentage = total > 0 ? ((female / total) * 100).toFixed(1) : 0;

                    const marker = L.marker(coordinates).addTo(map);
                    marker.bindPopup(
                        `<b>${location}</b><br>
                        Totaal aantal studenten: ${total.toLocaleString('nl-NL')}<br><br>
                        Mannen: ${male.toLocaleString('nl-NL')} (${malePercentage}%)<br>
                        Vrouwen: ${female.toLocaleString('nl-NL')} (${femalePercentage}%)`
                    );
                }
            }
        });
    }

    // Event listeners for dropdowns
    dataTypeSelect.addEventListener('change', function () {
        toggleVisibility(); // Ensure visibility is updated when the data type changes
        loadChart(this.value);
    });

    yearSelect.addEventListener('change', function () {
        loadChart(dataTypeSelect.value);
    });

    locationSelect.addEventListener('change', function () {
        loadChart(dataTypeSelect.value);
    });

    schoolSelect.addEventListener('change', function () {
        loadChart(dataTypeSelect.value);
    });

    educationSelect.addEventListener('change', function () {
        loadChart(dataTypeSelect.value);
    });

    // Event listeners to dynamically update dropdowns
    locationSelect.addEventListener('change', updateLocationAndEducationOptions);
    schoolSelect.addEventListener('change', updateLocationAndEducationOptions);
    educationSelect.addEventListener('change', updateLocationAndEducationOptions);

    // Event listener for fullscreen-button
    fullscreenButton.addEventListener('click', toggleFocusMode);

    function toggleFocusMode() {
        body.classList.toggle('fullscreen-mode');
        const containerLeft = document.querySelector('.container-left');
        const containerRight = document.querySelector('.container-right');
        const fullscreenIcon = fullscreenButton.querySelector('i');

        if (body.classList.contains('fullscreen-mode')) {
            fullscreenIcon.classList.remove('fa-expand');
            fullscreenIcon.classList.add('fa-compress');

            containerLeft.style.transition = 'width 0.5s ease, padding 0.5s ease'; // Ensure independent transition
            containerRight.style.transition = 'width 0.5s ease';

            containerLeft.classList.add('collapsed');
            containerLeft.classList.remove('expanded');
            containerRight.classList.add('expanded');
            containerRight.classList.remove('collapsed');
        } else {
            fullscreenIcon.classList.remove('fa-compress');
            fullscreenIcon.classList.add('fa-expand');

            containerLeft.style.transition = 'width 0.5s ease, padding 0.5s ease'; // Ensure independent transition
            containerRight.style.transition = 'width 0.5s ease';

            containerLeft.classList.add('expanded');
            containerLeft.classList.remove('collapsed');
            containerRight.classList.add('collapsed');
            containerRight.classList.remove('expanded');
        }
    }

    // Utility function to set a cookie
    function setCookie(name, value, days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
    }

    // Utility function to get a cookie
    function getCookie(name) {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(`${name}=`)) {
                return cookie.substring(name.length + 1);
            }
        }
        return null;
    }

    // Load the saved mode from the cookie
    const savedMode = getCookie('theme');
    if (savedMode === 'dark') {
        document.body.classList.add('dark-mode');
        lightDarkToggle.querySelector('i').classList.remove('fa-moon');
        lightDarkToggle.querySelector('i').classList.add('fa-sun');

        // Apply dark mode styles dynamically on page load
        const elementsToStyle = [
            { selector: 'body', styles: { backgroundColor: '#121212', color: '#ffffff', transition: 'background-color 0.5s, color 0.5s' } },
            { selector: '.container-left', styles: { backgroundColor: '#1e1e1e', transition: 'background-color 0.5s' } },
            { selector: '.container-right', styles: { backgroundColor: '#0c2744', transition: 'background-color 0.5s' } },
            { selector: 'select', styles: { backgroundColor: '#2a2a2a', color: '#ffffff', borderColor: '#444444', backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23ffffff%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3e%3cpolyline points=%276 9 12 15 18 9%27%3e%3c/polyline%3e%3c/svg%3e')", transition: 'background-color 0.5s, color 0.5s, border-color 0.5s' }},
            { selector: '.container', styles: { borderColor: '#2a2a2a', transition: 'border-color 0.5s' } },
            { selector: 'a', styles: { color: '#ffffff', transition: 'color 0.5s' } },
            { selector: '.background-image', styles: { filter: 'brightness(0.7)', transition: 'filter 0.5s' } }, // Apply filter to the background image
            { selector: 'button.reset-button', styles: { color: '#FFFFFF', transition: 'border-color 0.5s' } }
        ];

        elementsToStyle.forEach(({ selector, styles }) => {
            document.querySelectorAll(selector).forEach(element => {
                Object.assign(element.style, styles);
            });
        });
    }

    lightDarkToggle.addEventListener('click', function () {
        const isDarkMode = document.body.classList.toggle('dark-mode');
        const icon = lightDarkToggle.querySelector('i');

        // Toggle icon between moon and sun
        if (isDarkMode) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
            setCookie('theme', 'dark', 30); // Save dark mode preference for 30 days
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
            setCookie('theme', 'light', 30); // Save light mode preference for 30 days
        }

        // Apply dark mode styles dynamically
        const elementsToStyle = [
            { selector: 'body', styles: { backgroundColor: isDarkMode ? '#121212' : '', color: isDarkMode ? '#ffffff' : '', transition: 'background-color 0.5s, color 0.5s' } },
            { selector: '.container-left', styles: { backgroundColor: isDarkMode ? '#1e1e1e' : '', transition: 'background-color 0.5s' } },
            { selector: '.container-right', styles: { backgroundColor: isDarkMode ? '#0c2744' : '', transition: 'background-color 0.5s' } },
            { selector: 'select', styles: { 
                backgroundColor: isDarkMode ? '#2a2a2a' : '', 
                color: isDarkMode ? '#ffffff' : '', 
                borderColor: isDarkMode ? '#444444' : '', 
                backgroundImage: isDarkMode 
                    ? "url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23ffffff%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3e%3cpolyline points=%276 9 12 15 18 9%27%3e%3c/polyline%3e%3c/svg%3e')" 
                    : "url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23003091%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3e%3cpolyline points=%276 9 12 15 18 9%27%3e%3c/polyline%3e%3c/svg%3e')", 
                transition: 'background-color 0.5s, color 0.5s, border-color 0.5s' 
            }},
            { selector: '.container', styles: { borderColor: isDarkMode ? '#2a2a2a' : '', transition: 'border-color 0.5s' } },
            { selector: 'a', styles: { color: isDarkMode ? '#ffffff' : '', transition: 'color 0.5s' } },
            { selector: '.background-image', styles: { filter: isDarkMode ? 'brightness(0.7)' : '', transition: 'filter 0.5s' } }, // Apply filter to the background image
            { selector: 'button.reset-button', styles: { color: isDarkMode ? '#FFFFFF' : '', transition: 'border-color 0.5s' } }
        ];

        elementsToStyle.forEach(({ selector, styles }) => {
            document.querySelectorAll(selector).forEach(element => {
                Object.assign(element.style, styles);
            });
        });

        // Reload the map with the updated theme
        if (map) {
            const location = locationSelect.value || null;
            const school = schoolSelect.value || null;
            const education = educationSelect.value || null;
            const year = yearSelect.value || null;
            createMap(location, school, education, year);
        }
    });

    const resetButton = document.querySelector('.reset-button');

    resetButton.addEventListener('click', function () {
        // Reset all selects to their default values
        locationSelect.value = ""; // Reset locationSelect to no selection
        schoolSelect.value = ""; // Reset schoolSelect to no selection
        educationSelect.value = ""; // Reset educationSelect to no selection

        // Repopulate the dropdowns to reflect the reset state
        updateLocationAndEducationOptions();

        // Reload the chart with the default data type
        loadChart(dataTypeSelect.value);
    });
});