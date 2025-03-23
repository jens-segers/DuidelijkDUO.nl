document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM is loaded and custom Script is running");

    var body = document.body;
    var chartCanvas = document.getElementById('myChart');
    var dataTypeSelect = document.getElementById('dataTypeSelect');
    var locationSelect = document.getElementById('locationSelect');
    var educationSelect = document.getElementById('educationSelect');
    var yearSelect = document.getElementById('yearSelect');

    const fullscreenButton = document.querySelector('.close-button');

    let jsonData;
    let myChart;

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
            loadChart(dataTypeSelect.value); // Default chart
        });

    function populateFilterOptions() {
        const locations = {
            Provincie: new Set(),
            Gemeente: new Set(),
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
            if (entry['OPLEIDINGSNAAM ACTUEEL']) educations.Opleiding.add(entry['OPLEIDINGSNAAM ACTUEEL']);
            for (const [key, value] of Object.entries(entry)) {
                if (key.match(/^\d{4}$/)) years.Jaar.add(key);
            }
        });

        // Create a pull-down menu for each location. The keys of the locations appeaar as an Option group with the values as options.
        populateSelectList(locations, locationSelect, "Alle locaties");
        populateSelectList(educations, educationSelect, "Alle opleidingen");
        populateSelectList(years, yearSelect);

        // Hide the year select if dataTypeSelect is not 'genderDistribution'
        // by adding CSS class 'hidden' to the element
        toggleVisibility();
    }

    function toggleVisibility() {
        yearSelect.classList.toggle('hidden', dataTypeSelect.value !== 'genderDistribution');
    }

    /*
     * Populate a select list with options from a data object.
     * The data is a map with keys as group names and values as arrays of options.
     * For each key an option group is added to the select list.
     * The selectList is a select element to populate with the data.
     */
    function populateSelectList(data, selectList, noneOption) {
        if (noneOption !== undefined) {
            // Add an option to select nothing
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

    function loadChart(type) {
        if (myChart) myChart.destroy();

        switch (type) {
            case 'genderDistribution':
                createGenderDistributionChart(locationSelect.value, educationSelect.value, yearSelect.value);
                break;
            case 'totalCount':
                createTotalCountChart(locationSelect.value, educationSelect.value);
                break;
            default:
                console.log('Unknown chart type');
        }
    }

    function filterData(location, education, year) {
        return jsonData
            .filter(entry => {
                return (!education || entry['OPLEIDINGSNAAM ACTUEEL'] === education)
                    && (!location || entry['PROVINCIE'] === location || entry['GEMEENTENAAM'] === location);
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
            }
            );
    }

    function createGenderDistributionChart(location, education, year) {
        // Filter de data op basis van locatie, opleiding en jaar
        const filteredData = filterData(location, education, year);

        // Bereken het aantal mannen en vrouwen
        const genderCounts = filteredData.reduce((acc, entry) => {
            acc[entry.GESLACHT] = (acc[entry.GESLACHT] || 0) + 1;
            return acc;
        }, {});

        const total = genderCounts['man'] + genderCounts['vrouw'];
        const malePercentage = ((genderCounts['man'] / total) * 100).toFixed(1); // Percentage mannen
        const femalePercentage = ((genderCounts['vrouw'] / total) * 100).toFixed(1); // Percentage vrouwen

        // Maak de cirkeldiagram
        myChart = new Chart(chartCanvas, {
            type: 'pie',
            data: {
                labels: ['Man', 'Vrouw'],
                datasets: [{
                    label: 'Geslachtsverdeling',
                    data: [genderCounts['man'], genderCounts['vrouw']],
                    backgroundColor: ['rgba(54, 162, 235, 0.4)', 'rgba(255, 99, 132, 0.4)'],
                    borderColor: ['rgb(54, 162, 235)', 'rgb(255, 99, 132)'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
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
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${context.label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    function createTotalCountChart(location, education) {
        const total = {};
        const growthRates = [];

        // Filter de data op basis van locatie en opleiding
        var filteredData = filterData(location, education);

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
                                return `${datasetLabel}: ${value}`;
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
                            color: '#FFFFFF'
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

    // Event listeners for dropdowns
    dataTypeSelect.addEventListener('change', function () {
        toggleVisibility();
        loadChart(this.value);
    });

    yearSelect.addEventListener('change', function () {
        loadChart(dataTypeSelect.value);
    });

    locationSelect.addEventListener('change', function () {
        loadChart(dataTypeSelect.value);
    });

    educationSelect.addEventListener('change', function () {
        loadChart(dataTypeSelect.value);
    });

    // Event listener for fullscreen-button
    fullscreenButton.addEventListener('click', toggleFocusMode);

    function toggleFocusMode() {
        body.classList.toggle('focus-mode');
        const containerLeft = document.querySelector('.container-left');
        const containerRight = document.querySelector('.container-right');
        const fullscreenIcon = fullscreenButton.querySelector('i');

        if (body.classList.contains('focus-mode')) {
            fullscreenIcon.classList.remove('fa-expand');
            fullscreenIcon.classList.add('fa-compress');

            containerLeft.classList.add('collapsed');
            containerLeft.classList.remove('expanded');
            containerRight.classList.add('expanded');
            containerRight.classList.remove('collapsed');
        } else {
            fullscreenIcon.classList.remove('fa-compress');
            fullscreenIcon.classList.add('fa-expand');
            containerLeft.classList.add('expanded');
            containerLeft.classList.remove('collapsed');
            containerRight.classList.add('collapsed');
            containerRight.classList.remove('expanded');
        }
    }
});