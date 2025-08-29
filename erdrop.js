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
                        ${task.selesaiHariIni ? 'disabled' : ''}
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

    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newTask = {
        id: isEditMode ? parseInt(taskIdInput.value) : Date.now(),
        nama: namaGarapanInput.value.trim(),
        tugas: tugasGarapanInput.value.trim(),
        link: linkInput.value.trim(),
        akun: parseInt(banyakAkunInput.value),
        status: keteranganInput.value,
        selesaiHariIni: false,
        tanggalDitambahkan: formattedDate
    };

    if (isEditMode) {
        tasks = tasks.map(task => task.id === newTask.id ? { ...newTask, tanggalDitambahkan: task.tanggalDitambahkan } : task);
        isEditMode = false;
    } else {
        tasks.push(newTask);
    }
    
    saveTasks();
    currentPage = 1;
    renderTasks();
    resetForm();
}

async function handleTableClick(e) {
    const target = e.target;
    const id = parseInt(target.dataset.id);

    if (target.classList.contains('delete-btn')) {
        const confirmed = await showConfirm('Apakah Anda yakin ingin menghapus task ini?');
        if (confirmed) {
            tasks = tasks.filter(task => task.id !== id);
            saveTasks();
            currentPage = 1;
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
    } else if (target.classList.contains('open-link')) {
        const taskToUpdate = tasks.find(task => task.id === id);
        if (taskToUpdate) {
            taskToUpdate.selesaiHariIni = true;
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
    
    const nextResetTimestamp = localStorage.getItem('nextResetTimestamp');
    const now = new Date();

    if (!nextResetTimestamp || now.getTime() >= parseInt(nextResetTimestamp)) {
        console.log('Waktu reset terlewati! Mereset status harian...');

        tasks = tasks.map(task => ({ ...task, selesaiHariIni: false }));
        saveTasks();

        const nextResetDate = new Date();
        nextResetDate.setHours(RESET_HOUR_WIB, 0, 0, 0);

        if (now.getTime() >= nextResetDate.getTime()) {
            nextResetDate.setDate(nextResetDate.getDate() + 1);
        }

        localStorage.setItem('nextResetTimestamp', nextResetDate.getTime());
        console.log(`Reset berikutnya dijadwalkan pada: ${nextResetDate}`);
    }
}

function exportTasksToTxt() {
    if (tasks.length === 0) {
        showAlert('Tidak ada data untuk diekspor!');
        return;
    }
    const dataStr = JSON.stringify(tasks, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'text/plain;charset=utf-8' });
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
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (Array.isArray(importedData)) {
                tasks = importedData;
                saveTasks();
                currentPage = 1;
                renderTasks();
                showAlert('Data berhasil diimpor!');
            } else {
                throw new Error('Format data di dalam file tidak valid.');
            }
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
exportBtn.addEventListener('click', exportTasksToTxt);
importBtn.addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', handleImport);


checkAndResetDailyStatus();
renderTasks();
