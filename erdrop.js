const taskForm = document.getElementById('task-form');
const taskList = document.getElementById('task-list');
const formTitle = document.getElementById('form-title');
const submitBtn = document.getElementById('submit-btn');
const resetBtn = document.getElementById('reset-btn');
const taskIdInput = document.getElementById('task-id');
const namaGarapanInput = document.getElementById('nama-garapan');
const tugasGarapanInput = document.getElementById('tugas-garapan');
const linkInput = document.getElementById('link');
const banyakAkunInput = document.getElementById('banyak-akun');
const keteranganInput = document.getElementById('keterangan');
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFileInput = document.getElementById('import-file');
const customAlertOverlay = document.getElementById('custom-alert-overlay');
const customAlertMessage = document.getElementById('custom-alert-message');
const customAlertOkBtn = document.getElementById('custom-alert-ok-btn');
const customConfirmOverlay = document.getElementById('custom-confirm-overlay');
const customConfirmMessage = document.getElementById('custom-confirm-message');
const customConfirmYesBtn = document.getElementById('custom-confirm-yes-btn');
const customConfirmNoBtn = document.getElementById('custom-confirm-no-btn');
let confirmResolver;
const customPromptOverlay = document.getElementById('custom-prompt-overlay');
const customPromptMessage = document.getElementById('custom-prompt-message');
const customPromptInput = document.getElementById('custom-prompt-input');
const customPromptOkBtn = document.getElementById('custom-prompt-ok-btn');
const customPromptCancelBtn = document.getElementById('custom-prompt-cancel-btn');
let promptResolver;


function requestNotificationPermission() {
    if ('Notification' in window) {
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('Izin notifikasi diberikan.');
                }
            });
        }
    }
}

function showDailyNotification() {
    if (!('Notification' in window)) {
        showAlert('Browser ini tidak mendukung notifikasi.');
        return;
    }

    if (Notification.permission === 'granted') {
        const notificationOptions = {
            body: 'Jangan lupa kerjakan tugas airdrop Anda untuk hari ini.',
            icon: 'iconsiac.png'
        };

        if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
             navigator.serviceWorker.ready.then(reg => {
                reg.showNotification('Waktunya Cek Garapan Harian!', notificationOptions);
             });
        } else {
            new Notification('Waktunya Cek Garapan Harian!', notificationOptions);
        }
    }
}

let tasks = JSON.parse(localStorage.getItem('airdropTasks')) || [];
let isEditMode = false;
let currentPage = 1;
const rowsPerPage = 10;

function showAlert(message) {
    customAlertMessage.textContent = message;
    customAlertOverlay.classList.remove('custom-modal-hidden');
}

customAlertOkBtn.addEventListener('click', () => {
    customAlertOverlay.classList.add('custom-modal-hidden');
});

function showConfirm(message) {
    customConfirmMessage.textContent = message;
    customConfirmOverlay.classList.remove('custom-modal-hidden');
    return new Promise(resolve => {
        confirmResolver = resolve;
    });
}

function showPrompt(message) {
    customPromptMessage.textContent = message;
    customPromptInput.value = '';
    customPromptOverlay.classList.remove('custom-modal-hidden');
    customPromptInput.focus();
    return new Promise(resolve => {
        promptResolver = resolve;
    });
}

customConfirmYesBtn.addEventListener('click', () => {
    if (confirmResolver) {
        customConfirmOverlay.classList.add('custom-modal-hidden');
        confirmResolver(true);
    }
});

customConfirmNoBtn.addEventListener('click', () => {
    if (confirmResolver) {
        customConfirmOverlay.classList.add('custom-modal-hidden');
        confirmResolver(false);
    }
});

customPromptOkBtn.addEventListener('click', () => {
    if (promptResolver) {
        customPromptOverlay.classList.add('custom-modal-hidden');
        promptResolver(customPromptInput.value);
    }
});

customPromptCancelBtn.addEventListener('click', () => {
    if (promptResolver) {
        customPromptOverlay.classList.add('custom-modal-hidden');
        promptResolver(null);
    }
});


function saveTasks() {
    localStorage.setItem('airdropTasks', JSON.stringify(tasks));
}

function renderTasks() {
    taskList.innerHTML = '';
    const searchTerm = searchInput.value.toLowerCase();
    const statusFilter = filterStatus.value;

    const filteredTasks = tasks.filter(task => {
        const matchesSearch = task.nama.toLowerCase().includes(searchTerm) ||
                              task.tugas.toLowerCase().includes(searchTerm);
        const matchesStatus = statusFilter === 'Semua' || task.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

    if (paginatedTasks.length === 0 && filteredTasks.length > 0) {
        currentPage = Math.ceil(filteredTasks.length / rowsPerPage);
        renderTasks();
        return;
    }
    
    if (paginatedTasks.length === 0) {
        taskList.innerHTML = `<tr><td colspan="8" style="text-align: center;">Belum ada garapan</td></tr>`;
    } else {
        paginatedTasks.forEach(task => {
            const row = document.createElement('tr');
            const isSelesai = task.selesaiHariIni ? 'selesai' : 'belum';
            const statusText = task.selesaiHariIni ? '✓ Selesai' : 'X Belum';

            row.innerHTML = `
                <td>${task.nama}</td>
                <td>${task.tugas}</td>
                <td>
                    <a href="${task.link}" 
                       target="_blank" 
                       rel="noopener noreferrer" 
                       class="open-link" 
                       data-id="${task.id}"
                    >Open</a>
                </td>
                <td>${task.akun}</td>
                <td><span class="status ${task.status.toLowerCase().replace(' ', '-')}">${task.status}</span></td>
                <td>
                    <button class="today-btn ${isSelesai}" 
                            data-id="${task.id}"
                    >${statusText}</button>
                </td>
                <td>${task.tanggalDitambahkan}</td>
                <td>
                    <button class="action-btn end-btn" data-id="${task.id}">End</button>
                    <button class="action-btn edit-btn" data-id="${task.id}">Edit</button>
                    <button class="action-btn delete-btn" data-id="${task.id}">Hapus</button>
                </td>
            `;
            taskList.appendChild(row);
        });
    }

    setupPagination(filteredTasks.length);
}

function setupPagination(totalItems) {
    const paginationContainer = document.getElementById('pagination-container');
    paginationContainer.innerHTML = '';
    const pageCount = Math.ceil(totalItems / rowsPerPage);

    if (pageCount > 1) {
        const prevButton = document.createElement('button');
        prevButton.innerText = 'Prev';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTasks();
            }
        });
        paginationContainer.appendChild(prevButton);

        const pageInfo = document.createElement('span');
        pageInfo.innerText = `Page ${currentPage} of ${pageCount}`;
        paginationContainer.appendChild(pageInfo);

        const nextButton = document.createElement('button');
        nextButton.innerText = 'Next';
        nextButton.disabled = currentPage === pageCount;
        nextButton.addEventListener('click', () => {
            if (currentPage < pageCount) {
                currentPage++;
                renderTasks();
            }
        });
        paginationContainer.appendChild(nextButton);
    }
}

function handleFormSubmit(e) {
    e.preventDefault();
    
    const id = taskIdInput.value ? parseInt(taskIdInput.value) : Date.now();
    const taskIndex = tasks.findIndex(task => task.id === id);

    let tanggalDitambahkan;
    if (isEditMode && taskIndex > -1) {
        tanggalDitambahkan = tasks[taskIndex].tanggalDitambahkan;
    } else {
        const now = new Date();
        tanggalDitambahkan = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }

    const taskData = {
        id: id,
        nama: namaGarapanInput.value.trim(),
        tugas: tugasGarapanInput.value.trim(),
        link: linkInput.value.trim(),
        akun: parseInt(banyakAkunInput.value),
        status: keteranganInput.value,
        selesaiHariIni: isEditMode && taskIndex > -1 ? tasks[taskIndex].selesaiHariIni : false,
        tanggalDitambahkan: tanggalDitambahkan
    };

    if (isEditMode && taskIndex > -1) {
        tasks[taskIndex] = taskData;
    } else {
        tasks.push(taskData);
    }
    
    saveTasks();
    renderTasks();
    resetForm();
}

async function handleTableClick(e) {
    const target = e.target;
    if (!target.dataset.id) return;
    
    const id = parseInt(target.dataset.id);

    if (target.classList.contains('delete-btn')) {
        const confirmed = await showConfirm('Apakah Anda yakin ingin menghapus task ini?');
        if (confirmed) {
            tasks = tasks.filter(task => task.id !== id);
            saveTasks();
            renderTasks();
        }
    } else if (target.classList.contains('edit-btn')) {
        const taskToEdit = tasks.find(task => task.id === id);
        if (taskToEdit) {
            isEditMode = true;
            taskIdInput.value = taskToEdit.id;
            namaGarapanInput.value = taskToEdit.nama;
            tugasGarapanInput.value = taskToEdit.tugas;
            linkInput.value = taskToEdit.link;
            banyakAkunInput.value = taskToEdit.akun;
            keteranganInput.value = taskToEdit.status;
            formTitle.textContent = "Edit Garapan";
            submitBtn.textContent = "Update";
            window.scrollTo(0, 0);
        }
    } else if (target.classList.contains('end-btn')) {
        tasks = tasks.map(task =>
            task.id === id ? { ...task, status: "END" } : task
        );
        saveTasks();
        renderTasks();
    } else if (target.classList.contains('today-btn') || target.classList.contains('open-link')) {
        const taskToUpdate = tasks.find(task => task.id === id);
        if (taskToUpdate) {
            if (target.classList.contains('today-btn')) {
                 taskToUpdate.selesaiHariIni = !taskToUpdate.selesaiHariIni;
            } else {
                 taskToUpdate.selesaiHariIni = true;
            }
            saveTasks();
            renderTasks();
        }
    }
}

function resetForm() {
    taskForm.reset();
    isEditMode = false;
    taskIdInput.value = '';
    formTitle.textContent = "Tambah Garapan Baru";
    submitBtn.textContent = "Tambah";
}

function checkAndResetDailyStatus() {
    const RESET_HOUR_WIB = 7;
    const lastReset = localStorage.getItem('lastReset');
    const now = new Date();
    
    const todayResetTime = new Date();
    todayResetTime.setHours(RESET_HOUR_WIB, 0, 0, 0);

    if (!lastReset || new Date(parseInt(lastReset)) < todayResetTime) {
        if (now.getHours() >= RESET_HOUR_WIB) {
            console.log('Waktu reset terlewati! Mereset status harian...');
            tasks = tasks.map(task => ({ ...task, selesaiHariIni: false }));
            saveTasks();
            renderTasks();
            localStorage.setItem('lastReset', now.getTime());
            showDailyNotification();
        }
    }
}

async function exportDataToTxt() {
    const transactionsForExport = JSON.parse(localStorage.getItem('transactions')) || [];
    if (tasks.length === 0 && transactionsForExport.length === 0) {
        showAlert('Tidak ada data untuk diekspor!');
        return;
    }

    const usePassword = await showConfirm('Apakah Anda ingin melindungi file ini dengan kata sandi?');
    let password = null;
    if (usePassword) {
        password = await showPrompt('Masukkan kata sandi untuk enkripsi:');
        if (!password) {
            showAlert('Ekspor dibatalkan. Tidak ada kata sandi yang diberikan.');
            return;
        }
    }
    
    const dataToExport = {
        airdropTasks: tasks,
        financeTransactions: transactionsForExport
    };

    let dataStr = JSON.stringify(dataToExport, null, 2);
    let finalData;

    if (password) {
        const encrypted = CryptoJS.AES.encrypt(dataStr, password).toString();
        finalData = JSON.stringify({ encryptedData: encrypted });
    } else {
        finalData = dataStr;
    }

    const dataBlob = new Blob([finalData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 10);
    link.download = `iac-airdrops-backup-${timestamp}.txt`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
}

async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const confirmed = await showConfirm('Ini akan menimpa semua data saat ini. Lanjutkan?');
    if (!confirmed) {
        event.target.value = null;
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const fileContent = e.target.result;
            let importedData;
            try {
                importedData = JSON.parse(fileContent);
            } catch (error) {
                showAlert('Gagal mem-parsing file. Pastikan file tersebut adalah file backup yang valid.');
                return;
            }

            if (importedData && importedData.encryptedData) {
                const password = await showPrompt('File ini dienkripsi. Masukkan kata sandi:');
                if (password === null) {
                    showAlert('Impor dibatalkan.');
                    return;
                }
                try {
                    const decryptedBytes = CryptoJS.AES.decrypt(importedData.encryptedData, password);
                    const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);
                    if (!decryptedText) {
                        throw new Error('Kata sandi salah atau data rusak.');
                    }
                    importedData = JSON.parse(decryptedText);
                } catch (err) {
                    showAlert('Gagal mendekripsi data. Kata sandi salah.');
                    return;
                }
            }
            
            const hasAirdropData = importedData && Array.isArray(importedData.airdropTasks);
            const hasFinanceData = importedData && Array.isArray(importedData.financeTransactions);
            const isOldFormat = Array.isArray(importedData);

            if (hasAirdropData || hasFinanceData) {
                tasks = hasAirdropData ? importedData.airdropTasks : [];
                const transactionsData = hasFinanceData ? importedData.financeTransactions : [];
                localStorage.setItem('transactions', JSON.stringify(transactionsData));
                showAlert('Data garapan berhasil diimpor!');
            } else if (isOldFormat) {
                tasks = importedData;
                localStorage.setItem('transactions', JSON.stringify([]));
                showAlert('Backup format lama berhasil diimpor. Data garapan telah dipulihkan.');
            } else {
                throw new Error('Format data di dalam file tidak valid.');
            }

            saveTasks();
            currentPage = 1;
            renderTasks();

        } catch (error) {
            showAlert(`Gagal mengimpor file: ${error.message}`);
        } finally {
            event.target.value = null;
        }
    };
    reader.readAsText(file);
}

taskForm.addEventListener('submit', handleFormSubmit);
taskList.addEventListener('click', handleTableClick);
resetBtn.addEventListener('click', resetForm);
searchInput.addEventListener('input', () => {
    currentPage = 1;
    renderTasks();
});
filterStatus.addEventListener('change', () => {
    currentPage = 1;
    renderTasks();
});
exportBtn.addEventListener('click', exportDataToTxt);
importBtn.addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', handleImport);

checkAndResetDailyStatus();
renderTasks();
requestNotificationPermission();
