document.addEventListener('DOMContentLoaded', () => {
    const faucetListContainer = document.getElementById('faucet-list');
    const searchInput = document.getElementById('search-faucet');

    const faucets = [
       {
            id: 'pharos_atlantic',
            name: 'Pharos Atlantic Testnet',
            description: 'Dapatkan PHRS di jaringan Pharos Atlantic Testnet',
            links: [
                { url: 'https://testnet.pharosnetwork.xyz/', text: 'Kunjungi testnet.pharosnetwork.xyz' },
                { url: 'https://zan.top/faucet/pharos', text: 'Kunjungi zan.top' },
                { url: 'https://faroswap.xyz/faucet', text: 'Kunjungi faroswap.xyz' },
            ]
        },
        {
            id: 'mawari',
            name: 'Mawari Network Testnet',
            description: 'Dapatkan Faucet Native Token [MAWARI] di jaringan Mawari Network Testnet',
            url: 'https://hub.testnet.mawari.net/',
            urlText: 'Kunjungi hub.testnet.mawari.net'
        },
        {
            id: 'giwa',
            name: 'Giwa Sepolia',
            description: 'Dapatkan ETH di jaringan Giwa Sepolia',
            url: 'https://faucet.giwa.io',
            urlText: 'Kunjungi faucet.giwa.io'
        },
        {
            id: 'pharos',
            name: 'Pharos Testnet',
            description: 'Dapatkan PHRS di jaringan Pharos Testnet dari Zan, Bitget wallet & Okx wallet',
            links: [
                { url: 'https://testnet.pharosnetwork.xyz/', text: 'Kunjungi testnet.pharosnetwork.xyz' },
                { url: 'https://zan.top/faucet/pharos', text: 'Kunjungi zan.top' },
                { url: 'https://web3.okx.com/zh-hans/faucet/pharos/100013', text: 'Kunjungi web3.okx.com' },
                { url: 'https://newshare.bwb.global/en/earnCoinsTasks?uuid=6b728693-35b6-4892-9991-a45e63aaf2a1&_nocache=true&_nobar=true&deeplink=true&_needChain=eth', text: 'Kunjungi newshare.bwb.global' },
            ]
        },
        {
            id: 'monad',
            name: 'Monad Testnet',
            description: 'Dapatkan MON di jaringan Monad Testnet',
            links: [
                { url: 'https://faucet.monad.xyz/', text: 'Kunjungi faucet.monad.xyz' },
                { url: 'https://www.gas.zip/faucet/monad', text: 'Kunjungi gas.zip' },
                { url: 'https://faucet.trade/monad-testnet-mon-faucet', text: 'Kunjungi faucet.trade' },
                { url: 'https://owlto.finance/Faucet/Monad', text: 'Kunjungi owlto.finance' },
            ]
        },
        {
            id: 'sepolia',
            name: 'Sepolia ETH',
            description: 'Dapatkan ETH testnet di jaringan ETH Sepolia',
            links: [
                { url: 'https://sepolia-faucet.pk910.de/', text: 'Kunjungi sepolia-faucet.pk910.de' },
                { url: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia', text: 'Kunjungi cloud.google.com' },
                { url: 'https://sepoliafaucet.com/', text: 'Kunjungi alchemy.com' },
                { url: 'https://faucet.quicknode.com/ethereum/sepolia', text: 'Kunjungi quicknode.com' },
                { url: 'https://faucet.triangleplatform.com/ethereum/sepolia', text: 'Kunjungi triangleplatform.com' },
            ]
        },
        {
            id: 'holesky',
            name: 'Holesky ETH',
            description: 'Dapatkan ETH testnet di jaringan Holesky Testnet',
            url: 'https://holeskyfaucet.io/',
            urlText: 'Kunjungi holeskyFaucet.io'
        },
        {
            id: 'goerli',
            name: 'Goerli ETH',
            description: 'Dapatkan ETH testnet di jaringan ETH Goerli',
            url: 'https://goerlifaucet.com/',
            urlText: 'Kunjungi goerliFaucet.com'
        },
        {
            id: 'mumbai',
            name: 'Mumbai (Polygon)',
            description: 'Dapatkan MATIC testnet untuk jaringan Mumbai (Polygon).',
            url: 'https://faucet.polygon.technology/',
            urlText: 'Kunjungi polygon.technology'
        },
        {
            id: 'bnb',
            name: 'BNB Testnet',
            description: 'Dapatkan BNB testnet di jaringan BNB Testnet',
            links: [
                { url: 'https://testnet.binance.org/faucet-smart', text: 'Kunjungi binance.org' },
                { url: 'https://faucet.quicknode.com/binance/bnb-testnet', text: 'Kunjungi quicknode.com' }
            ]
        },
        {
            id: 'base',
            name: 'Base Goerli',
            description: 'Dapatkan ETH testnet di jaringan Base Goerli',
            url: 'https://base/goerli',
            urlText: 'Kunjungi quicknode.com'
        },
        {
            id: 'arbitrum',
            name: 'Arbitrum Sepolia',
            description: 'Dapatkan ETH testnet di jaringan Arbitrum Sepolia.',
            url: 'https://faucet.triangleplatform.com/arbitrum/sepolia',
            urlText: 'Kunjungi triangleplatform.com'
        }
    ];

    function renderFaucets(faucetArray) {
        faucetListContainer.innerHTML = '';

        if (faucetArray.length === 0) {
            faucetListContainer.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">Tidak ada faucet yang cocok dengan pencarian Anda.</p>';
            return;
        }

        faucetArray.forEach(faucet => {
            const faucetItem = document.createElement('div');
            faucetItem.className = 'faucet-item';

            let linksHTML = '';
            if (faucet.links && faucet.links.length > 0) {
                const selectId = `select-${faucet.id}`;
                linksHTML = `
                    <label for="${selectId}">Pilih link faucet:</label>
                    <select id="${selectId}">
                        <option value="">-- pilih salah satu --</option>
                        ${faucet.links.map(link => `<option value="${link.url}">${link.text}</option>`).join('')}
                    </select>
                `;
            } else if (faucet.url) {
                linksHTML = `<a href="${faucet.url}" target="_blank" rel="noopener noreferrer" class="open-link">${faucet.urlText}</a>`;
            }

            faucetItem.innerHTML = `
                <h3>${faucet.name}</h3>
                <p>${faucet.description}</p>
                <div class="faucet-links">
                    ${linksHTML}
                </div>
            `;

            faucetListContainer.appendChild(faucetItem);
            if (faucet.links && faucet.links.length > 0) {
                const selectElement = faucetItem.querySelector(`#select-${faucet.id}`);
                selectElement.addEventListener('change', (e) => {
                    const url = e.target.value;
                    if (url) {
                        window.open(url, '_blank');
                        e.target.value = "";
                    }
                });
            }
        });
    }

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const filteredFaucets = faucets.filter(faucet => 
            faucet.name.toLowerCase().includes(searchTerm) || 
            faucet.description.toLowerCase().includes(searchTerm)
        );
        renderFaucets(filteredFaucets);
    });

    function applyHashFilter() {
        const hash = window.location.hash.replace('#', '').toLowerCase();
        if (hash) {
            const filtered = faucets.filter(f => f.id === hash);
            if (filtered.length > 0) {
                renderFaucets(filtered);
                searchInput.value = filtered[0].name;
                return;
            }
        }
        renderFaucets(faucets);
    }

    window.addEventListener('hashchange', applyHashFilter);
    applyHashFilter();
});

