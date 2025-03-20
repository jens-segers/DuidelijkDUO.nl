document.addEventListener("DOMContentLoaded", function() {
    console.log("DOM is loaded and custom Script is running");

    var body = document.body;
    var darkModeButton = document.getElementById('darkModeButton');
    var ChartCanvas = document.getElementById('myChart');
    var chartSelect = document.getElementById('chartSelect');

    let jsonData;
    let myChart;

    // Laad de JSON data
    fetch('/data/duo_ingeschrevenhbo_2024.json')
        .then(response => response.json())
        .then(data => {
            jsonData = data;
            loadChart('totalPerYear'); // standaard grafiek
        });

    function loadChart(type) {
        if (myChart) myChart.destroy();

        switch (type) {
            case 'totalPerYear':
                createTotalPerYearChart();
                break;
            case 'studentsPerProvince':
                createStudentsPerProvinceChart();
                break;
            case 'genderDistribution':
                createGenderDistributionChart();
                break;
            case 'specificCourseTrend':
                createSpecificCourseTrendChart();
                break;
            case 'educationForm':
                createEducationFormChart();
                break;
            default:
                console.log('Unknown chart type');
        }
    }

    // 1. Totaal aantal inschrijvingen per jaar
    function createTotalPerYearChart() {
        const years = ['2020', '2021', '2022', '2023', '2024'];
        const totals = { '2020': 0, '2021': 0, '2022': 0, '2023': 0, '2024': 0 };

        jsonData.forEach(entry => {
            years.forEach(year => {
                let value = entry[year];
                if (typeof value === 'string' && value.includes('<')) value = 0;
                totals[year] += parseInt(value) || 0;
            });
        });

        myChart = new Chart(ChartCanvas, {
            type: 'line',
            data: {
                labels: years,
                datasets: [{
                    label: 'Totaal aantal inschrijvingen',
                    data: years.map(y => totals[y]),
                    backgroundColor: 'rgba(255, 255, 255, 0.4)',
                    borderColor: 'rgb(255, 255, 255)',
                    tension: 0.1
                }]
            },
            options: {
                plugins: {
                    legend: {
                        labels: {
                            color: '#FFFFFF' // Legenda tekst wit
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#FFFFFF' // X-as tekst wit
                        },
                        grid: {
                            color: '#FFFFFF' // Optioneel: gridkleur donkerder (mooier op donkere achtergrond)
                        }
                    },
                    y: {
                        ticks: {
                            color: '#FFFFFF' // Y-as tekst wit
                        },
                        grid: {
                            color: '#FFFFFF'
                        }
                    }
                }
            }
        });
    }

    // 2. Aantal studenten per provincie (2024)
    function createStudentsPerProvinceChart() {
        const provinceTotals = {};

        jsonData.forEach(entry => {
            const provincie = entry.PROVINCIE;
            let value = entry['2024'];
            if (typeof value === 'string' && value.includes('<')) value = 0;
            provinceTotals[provincie] = (provinceTotals[provincie] || 0) + parseInt(value) || 0;
        });

        myChart = new Chart(ChartCanvas, {
            type: 'bar',
            data: {
                labels: Object.keys(provinceTotals),
                datasets: [{
                    label: 'Aantal studenten in 2024',
                    data: Object.values(provinceTotals),
                    backgroundColor: 'rgba(255, 255, 255, 0.4)',
                    borderColor: 'rgb(255, 255, 255)',
                    borderWidth: 1
                }]
            },
            options: {
                plugins: {
                    legend: {
                        labels: {
                            color: '#FFFFFF' // Legenda tekst wit
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#FFFFFF' // X-as tekst wit
                        },
                        grid: {
                            color: '#FFFFFF' // Optioneel: gridkleur donkerder (mooier op donkere achtergrond)
                        }
                    },
                    y: {
                        ticks: {
                            color: '#FFFFFF' // Y-as tekst wit
                        },
                        grid: {
                            color: '#FFFFFF'
                        }
                    }
                }
            }
        });
    }

    // 3. Verdeling mannen/vrouwen binnen 'B Opleiding tot leraar Basisonderwijs'
    function createGenderDistributionChart() {
        const genders = { man: 0, vrouw: 0 };
        jsonData.forEach(entry => {
            if (entry['OPLEIDINGSNAAM ACTUEEL'] === 'B Opleiding tot leraar Basisonderwijs') {
                let value = entry['2024'];
                if (typeof value === 'string' && value.includes('<')) value = 0;
                genders[entry.GESLACHT] += parseInt(value) || 0;
            }
        });

        myChart = new Chart(ChartCanvas, {
            type: 'pie',
            data: {
                labels: ['Man', 'Vrouw'],
                datasets: [{
                    label: 'Geslachtsverdeling (2024)',
                    data: [genders['man'], genders['vrouw']],
                    backgroundColor: ['rgba(54, 162, 235, 0.4)', 'rgba(255, 99, 132, 0.4)'],
                    borderColor: ['rgb(54, 162, 235)', 'rgb(255, 99, 132)'],
                    borderWidth: 1
                }]
            },
            options: {
                plugins: {
                    legend: {
                        labels: {
                            color: '#FFFFFF' // Legenda tekst wit
                        }
                    }
                }
            }
        });
    }

    // 4. Ontwikkeling 'B Commerciële Economie' over de jaren
    function createSpecificCourseTrendChart() {
        const years = ['2020', '2021', '2022', '2023', '2024'];
        const totals = { '2020': 0, '2021': 0, '2022': 0, '2023': 0, '2024': 0 };
        jsonData.forEach(entry => {
            if (entry['OPLEIDINGSNAAM ACTUEEL'] === 'B Commerciele Economie') {
                years.forEach(year => {
                    let value = entry[year];
                    if (typeof value === 'string' && value.includes('<')) value = 0;
                    totals[year] += parseInt(value) || 0;
                });
            }
        });

        myChart = new Chart(ChartCanvas, {
            type: 'line',
            data: {
                labels: years,
                datasets: [{
                    label: 'B Commerciële Economie',
                    data: years.map(y => totals[y]),
                    backgroundColor: 'rgba(255, 255, 255, 0.4)',
                    borderColor: 'rgb(255, 255, 255)',
                    tension: 0.1
                }]
            },
            options: {
                plugins: {
                    legend: {
                        labels: {
                            color: '#FFFFFF' // Legenda tekst wit
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#FFFFFF' // X-as tekst wit
                        },
                        grid: {
                            color: '#FFFFFF' // Optioneel: gridkleur donkerder (mooier op donkere achtergrond)
                        }
                    },
                    y: {
                        ticks: {
                            color: '#FFFFFF' // Y-as tekst wit
                        },
                        grid: {
                            color: '#FFFFFF'
                        }
                    }
                }
            }
        });
    }

    // 5. Vergelijking voltijd/deeltijd studenten (2024)
    function createEducationFormChart() {
        const forms = { voltijd: 0, deeltijd: 0, duaal: 0 };

        jsonData.forEach(entry => {
            let value = entry['2024'];
            if (typeof value === 'string' && value.includes('<')) value = 0;
            const vorm = entry.OPLEIDINGSVORM.split(' ')[0]; // eerste woord (voltijd/deeltijd/duaal)
            forms[vorm] += parseInt(value) || 0;
        });

        myChart = new Chart(ChartCanvas, {
            type: 'bar',
            data: {
                labels: Object.keys(forms),
                datasets: [{
                    label: 'Aantal studenten per opleidingsvorm (2024)',
                    data: Object.values(forms),
                    backgroundColor: 'rgba(255, 255, 255, 0.4)',
                    borderColor: 'rgb(255, 255, 255)',
                    borderWidth: 1
                }]
            },
            options: {
                plugins: {
                    legend: {
                        labels: {
                            color: '#FFFFFF' // Legenda tekst wit
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#FFFFFF' // X-as tekst wit
                        },
                        grid: {
                            color: '#FFFFFF' // Optioneel: gridkleur donkerder (mooier op donkere achtergrond)
                        }
                    },
                    y: {
                        ticks: {
                            color: '#FFFFFF' // Y-as tekst wit
                        },
                        grid: {
                            color: '#FFFFFF'
                        }
                    }
                }
            }
        });
    }

    // Event listener voor dropdown
    chartSelect.addEventListener('change', function() {
        loadChart(this.value);
    });

    // Dark Mode toggle blijft zoals het is (werkt met chart.update())
    darkModeButton.addEventListener('click', toggleDarkMode);

    function toggleDarkMode() {
        body.classList.toggle('dark-mode');
    
        if (body.classList.contains('dark-mode')) {
            darkModeButton.textContent = '💙 Normal Mode';
            document.querySelector('.container-right').style.transition = 'background-color 0.5s ease';
            document.querySelector('.container-right').style.backgroundColor = '#333';
            document.querySelector('.logo-image').style.transition = 'background-color 0.5s ease';
            document.querySelector('.logo-image').style.backgroundColor = '#333';
            document.querySelector('button').style.transition = 'background-color 0.5s ease';
            document.querySelector('button').style.backgroundColor = '#333';
            document.querySelector('select').style.transition = 'border-color 0.5s ease, color 0.5s ease';
            document.querySelector('select').style.borderColor = '#333';
            document.querySelector('select').style.color = '#333';
            document.querySelector('.background-image').style.transition = 'filter 0.5s ease';
            document.querySelector('.background-image').style.filter = 'grayscale(100%)';
    
            // ✅ Direct legend & ticks wit zetten
            myChart.options.plugins.legend.labels.color = '#FFFFFF';
            myChart.options.scales.x.ticks.color = '#FFFFFF';
            myChart.options.scales.x.grid.color = '#FFFFFF';
            myChart.options.scales.y.ticks.color = '#FFFFFF';
            myChart.options.scales.y.grid.color = '#FFFFFF';
            myChart.update();
    
        } else {
            darkModeButton.textContent = '👀 Focus Mode';
            document.querySelector('.container-right').style.transition = 'background-color 0.5s ease';
            document.querySelector('.container-right').style.backgroundColor = '#154273';
            document.querySelector('.logo-image').style.transition = 'background-color 0.5s ease';
            document.querySelector('.logo-image').style.backgroundColor = '#154273';
            document.querySelector('button').style.transition = 'background-color 0.5s ease';
            document.querySelector('button').style.backgroundColor = '#154273';
            document.querySelector('select').style.transition = 'border-color 0.5s ease, color 0.5s ease';
            document.querySelector('select').style.borderColor = '#154273';
            document.querySelector('select').style.color = '#154273';
            document.querySelector('.background-image').style.transition = 'filter 0.5s ease';
            document.querySelector('.background-image').style.filter = 'grayscale(0%)';
    
            // ✅ Ook hier legend & ticks wit houden
            myChart.options.plugins.legend.labels.color = '#FFFFFF';
            myChart.options.scales.x.ticks.color = '#FFFFFF';
            myChart.options.scales.x.grid.color = '#FFFFFF';
            myChart.options.scales.y.ticks.color = '#FFFFFF';
            myChart.options.scales.y.grid.color = '#FFFFFF';
            myChart.update();
        }
    }
});