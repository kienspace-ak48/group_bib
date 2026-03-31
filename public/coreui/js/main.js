/* global Chart, coreui */

/**
 * --------------------------------------------------------------------------
 * CoreUI Boostrap Admin Template main.js
 * Licensed under MIT (https://github.com/coreui/coreui-free-bootstrap-admin-template/blob/main/LICENSE)
 * --------------------------------------------------------------------------
 */

/**
 * Dashboard Charts
 *
 * Chỉ khởi tạo khi trang có canvas tương ứng (trang dashboard). Trang khác không có
 * #card-chart1 / #main-chart — tránh lỗi Chart.js và làm hỏng Bootstrap tab / JS toàn trang.
 */

// Configure Chart.js defaults for custom tooltips
Chart.defaults.pointHitDetectionRadius = 1;
Chart.defaults.plugins.tooltip.enabled = false;
Chart.defaults.plugins.tooltip.mode = 'index';
Chart.defaults.plugins.tooltip.position = 'nearest';
Chart.defaults.plugins.tooltip.external = coreui.ChartJS.customTooltips;
Chart.defaults.defaultFontColor = coreui.Utils.getStyle('--cui-body-color');

/**
 * Generates a random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer between min and max
 */
const random = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
const el = (id) => document.getElementById(id);

let cardChart1;
let cardChart2;
let cardChart3;
let cardChart4;
let mainChart;

if (el('card-chart1')) {
  cardChart1 = new Chart(el('card-chart1'), {
    type: 'line',
    data: {
      labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
      datasets: [{
        label: 'My First dataset',
        backgroundColor: 'transparent',
        borderColor: 'rgba(255,255,255,.55)',
        pointBackgroundColor: coreui.Utils.getStyle('--cui-primary'),
        data: [65, 59, 84, 84, 51, 55, 40]
      }]
    },
    options: {
      plugins: {
        legend: {
          display: false
        }
      },
      maintainAspectRatio: false,
      scales: {
        x: {
          border: {
            display: false
          },
          grid: {
            display: false,
            drawBorder: false
          },
          ticks: {
            display: false
          }
        },
        y: {
          min: 30,
          max: 89,
          display: false,
          grid: {
            display: false
          },
          ticks: {
            display: false
          }
        }
      },
      elements: {
        line: {
          borderWidth: 1,
          tension: 0.4
        },
        point: {
          radius: 4,
          hitRadius: 10,
          hoverRadius: 4
        }
      }
    }
  });
}

if (el('card-chart2')) {
  cardChart2 = new Chart(el('card-chart2'), {
    type: 'line',
    data: {
      labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
      datasets: [{
        label: 'My First dataset',
        backgroundColor: 'transparent',
        borderColor: 'rgba(255,255,255,.55)',
        pointBackgroundColor: coreui.Utils.getStyle('--cui-info'),
        data: [1, 18, 9, 17, 34, 22, 11]
      }]
    },
    options: {
      plugins: {
        legend: {
          display: false
        }
      },
      maintainAspectRatio: false,
      scales: {
        x: {
          border: {
            display: false
          },
          grid: {
            display: false,
            drawBorder: false
          },
          ticks: {
            display: false
          }
        },
        y: {
          min: -9,
          max: 39,
          display: false,
          grid: {
            display: false
          },
          ticks: {
            display: false
          }
        }
      },
      elements: {
        line: {
          borderWidth: 1
        },
        point: {
          radius: 4,
          hitRadius: 10,
          hoverRadius: 4
        }
      }
    }
  });
}

if (el('card-chart3')) {
  cardChart3 = new Chart(el('card-chart3'), {
    type: 'line',
    data: {
      labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
      datasets: [{
        label: 'My First dataset',
        backgroundColor: 'rgba(255,255,255,.2)',
        borderColor: 'rgba(255,255,255,.55)',
        data: [78, 81, 80, 45, 34, 12, 40],
        fill: true
      }]
    },
    options: {
      plugins: {
        legend: {
          display: false
        }
      },
      maintainAspectRatio: false,
      scales: {
        x: {
          display: false
        },
        y: {
          display: false
        }
      },
      elements: {
        line: {
          borderWidth: 2,
          tension: 0.4
        },
        point: {
          radius: 0,
          hitRadius: 10,
          hoverRadius: 4
        }
      }
    }
  });
}

if (el('card-chart4')) {
  cardChart4 = new Chart(el('card-chart4'), {
    type: 'bar',
    data: {
      labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April'],
      datasets: [{
        label: 'My First dataset',
        backgroundColor: 'rgba(255,255,255,.2)',
        borderColor: 'rgba(255,255,255,.55)',
        data: [78, 81, 80, 45, 34, 12, 40, 85, 65, 23, 12, 98, 34, 84, 67, 82],
        barPercentage: 0.6
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          grid: {
            display: false,
            drawTicks: false
          },
          ticks: {
            display: false
          }
        },
        y: {
          border: {
            display: false
          },
          grid: {
            display: false,
            drawBorder: false,
            drawTicks: false
          },
          ticks: {
            display: false
          }
        }
      }
    }
  });
}

if (el('main-chart')) {
  mainChart = new Chart(el('main-chart'), {
    type: 'line',
    data: {
      labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
      datasets: [{
        label: 'My First dataset',
        backgroundColor: `rgba(${coreui.Utils.getStyle('--cui-info-rgb')}, .1)`,
        borderColor: coreui.Utils.getStyle('--cui-info'),
        pointHoverBackgroundColor: '#fff',
        borderWidth: 2,
        data: [random(50, 200), random(50, 200), random(50, 200), random(50, 200), random(50, 200), random(50, 200), random(50, 200)],
        fill: true
      }, {
        label: 'My Second dataset',
        borderColor: coreui.Utils.getStyle('--cui-success'),
        pointHoverBackgroundColor: '#fff',
        borderWidth: 2,
        data: [random(50, 200), random(50, 200), random(50, 200), random(50, 200), random(50, 200), random(50, 200), random(50, 200)]
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        annotation: {
          annotations: {
            line1: {
              type: 'line',
              yMin: 95,
              yMax: 95,
              borderColor: coreui.Utils.getStyle('--cui-danger'),
              borderWidth: 1,
              borderDash: [8, 5]
            }
          }
        },
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          grid: {
            color: coreui.Utils.getStyle('--cui-border-color-translucent'),
            drawOnChartArea: false
          },
          ticks: {
            color: coreui.Utils.getStyle('--cui-body-color')
          }
        },
        y: {
          border: {
            color: coreui.Utils.getStyle('--cui-border-color-translucent')
          },
          grid: {
            color: coreui.Utils.getStyle('--cui-border-color-translucent')
          },
          ticks: {
            beginAtZero: true,
            color: coreui.Utils.getStyle('--cui-body-color'),
            max: 250,
            maxTicksLimit: 5,
            stepSize: Math.ceil(250 / 5)
          }
        }
      },
      elements: {
        line: {
          tension: 0.4
        },
        point: {
          radius: 0,
          hitRadius: 10,
          hoverRadius: 4,
          hoverBorderWidth: 3
        }
      }
    }
  });
}

document.documentElement.addEventListener('ColorSchemeChange', () => {
  if (!cardChart1 || !cardChart2 || !mainChart) {
    return;
  }
  cardChart1.data.datasets[0].pointBackgroundColor = coreui.Utils.getStyle('--cui-primary');
  cardChart2.data.datasets[0].pointBackgroundColor = coreui.Utils.getStyle('--cui-info');
  mainChart.options.scales.x.grid.color = coreui.Utils.getStyle('--cui-border-color-translucent');
  mainChart.options.scales.x.ticks.color = coreui.Utils.getStyle('--cui-body-color');
  mainChart.options.scales.y.border.color = coreui.Utils.getStyle('--cui-border-color-translucent');
  mainChart.options.scales.y.grid.color = coreui.Utils.getStyle('--cui-border-color-translucent');
  mainChart.options.scales.y.ticks.color = coreui.Utils.getStyle('--cui-body-color');
  cardChart1.update();
  cardChart2.update();
  mainChart.update();
});
//# sourceMappingURL=main.js.map
