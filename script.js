const {PDFDocument, StandardFonts} = PDFLib;

const $ = (...args) => document.querySelector(...args);
const $$ = (...args) => [...document.querySelectorAll(...args)];
let profil = {};

// Changement langue
function changeLangue(langue) {
    for (const _ of document.getElementsByClassName('langue')) {
        _.classList.remove('actif');
    }
    document.getElementById(langue).classList.add('actif');
    for (const champ of document.getElementsByClassName('texte')) {
        if (Object.keys(langues).indexOf(langue) > -1) {
            let idChamp = champ.id,
                traductionChamp = langues[langue][idChamp];
            champ.innerHTML = traductionChamp;
            // Change aussi le placeholder s'il existe et n'est pas une date
            if (idChamp.includes('label') &&
                champ.parentElement.nextElementSibling.hasAttribute('placeholder') &&
                champ.parentElement.nextElementSibling.getAttribute('type') != 'date') {
                champ.parentElement.nextElementSibling.setAttribute('placeholder', traductionChamp);
            }
        }
    }
    localStorage.setItem('langue', langue);
    
}
for (const el of document.getElementsByClassName('langue')) {
    el.addEventListener('click', () => changeLangue(el.id));
}
if (localStorage.getItem('langue')) {
    changeLangue(localStorage.getItem('langue'));
}

// Formattage Date
function pad (str) {
    return String(str).padStart(2, '0');
}

function getFormattedDate (date) {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    return `${year}-${month}-${day}`;
}
document.addEventListener('DOMContentLoaded', setReleaseDateTime);
function setReleaseDateTime () {
    const releaseDateInput = $('#date_sortie');
    const loadedDate = new Date();
    releaseDateInput.value = getFormattedDate(loadedDate);

    const hour = pad(loadedDate.getHours());
    const minute = pad(loadedDate.getMinutes());

    const releaseTimeInput = $('#heure_sortie');
    releaseTimeInput.value = `${hour}:${minute}`;
}

// QR Code
const generateQR = async (text) => {
  try {
    const opts = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
    }
      return await QRCode.toDataURL(text, opts);
  } catch (err) {
      console.error(err);
  }
}

// Création PDF
function idealFontSize (font, text, maxWidth, minSize, defaultSize) {
    let currentSize = defaultSize;
    let textWidth = font.widthOfTextAtSize(text, defaultSize);
    while (textWidth > maxWidth && currentSize > minSize) {
        textWidth = font.widthOfTextAtSize(text, --currentSize);
    }
    return textWidth > maxWidth ? null : currentSize;
}
async function generatePdf (profile, reasons) {
    const creationInstant = new Date();
    const creationDate = creationInstant.toLocaleDateString('fr-FR');
    const creationHour = creationInstant
          .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          .replace(':', 'h');

    const {
        adresse,
        code_postal,
        date_naissance,
        date_sortie,
        heure_sortie,
        lieu_naissance,
        nom,
        prenom,
        ville,
    } = profile;
    const releaseHours = String(heure_sortie).substring(0, 2);
    const releaseMinutes = String(heure_sortie).substring(3, 5);

  const data = [
      `Cree le: ${creationDate} a ${creationHour}`,
      `Nom: ${nom}`,
      `Prenom: ${prenom}`,
      `Naissance: ${date_naissance} a ${lieu_naissance}`,
      `Adresse: ${adresse} ${code_postal} ${ville}`,
      `Sortie: ${date_sortie} a ${releaseHours}h${releaseMinutes}`,
      `Motifs: ${reasons}`,
  ].join('; ');

    const existingPdfBytes = await fetch('./certificate.pdf').then((res) => res.arrayBuffer())

    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const page1 = pdfDoc.getPages()[0];

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const drawText = (text, x, y, size = 11) => {
        page1.drawText(text, { x, y, size, font });
    };
    
    drawText(`${prenom} ${nom}`, 123, 686);
    drawText(date_naissance, 123, 661);
    drawText(lieu_naissance, 92, 638);
    drawText(`${adresse} ${code_postal} ${ville}`, 134, 613);

    if (reasons.includes('travail')) {
        drawText('x', 76, 527, 19);
    }
    if (reasons.includes('courses')) {
        drawText('x', 76, 478, 19);
    }
    if (reasons.includes('sante')) {
        drawText('x', 76, 436, 19);
    }
    if (reasons.includes('famille')) {
        drawText('x', 76, 400, 19);
    }
    if (reasons.includes('sport')) {
        drawText('x', 76, 345, 19);
    }
    if (reasons.includes('judiciaire')) {
        drawText('x', 76, 298, 19);
    }
    if (reasons.includes('missions')) {
        drawText('x', 76, 260, 19);
    }
    let locationSize = idealFontSize(font, ville, 83, 7, 11);

    if (!locationSize) {
        alert(
            'Le nom de la ville risque de ne pas être affiché correctement en raison de sa longueur. ' +
                'Essayez d\'utiliser des abréviations ("Saint" en "St." par exemple) quand cela est possible.',
        );
        locationSize = 7;
    }
    drawText(ville, 111, 226, locationSize);
    if (reasons !== '') {
        // Date sortie
        drawText(`${date_sortie}`, 92, 200);
        drawText(releaseHours, 200, 201);
        drawText(releaseMinutes, 220, 201);
    }

    // Date création
    drawText('Date de création:', 464, 150, 7);
    drawText(`${creationDate} à ${creationHour}`, 455, 144, 7);

    const generatedQR = await generateQR(data);

    const qrImage = await pdfDoc.embedPng(generatedQR);

    page1.drawImage(qrImage, {
        x: page1.getWidth() - 170,
        y: 155,
        width: 100,
        height: 100,
    });

    pdfDoc.addPage()
    const page2 = pdfDoc.getPages()[1];
    page2.drawImage(qrImage, {
        x: 50,
        y: page2.getHeight() - 350,
        width: 300,
        height: 300,
    });

    const pdfBytes = await pdfDoc.save();

    return new Blob([pdfBytes], { type: 'application/pdf' });
}


// Télécharger attestation
function downloadBlob (blob, fileName) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
}

function getMotifs () {
    return $$('input[name="motif"]:checked')
        .map((x) => x.value)
        .join('-');
}
function saveProfil () {
    const champs = {};
    for (const field of $$('#champs-profil input')) {
        if (field.id === 'date_sortie-label') {
            const dateSortie = field.value.split('-');
            champs[dateSortie] = `${dateSortie[2]}/${dateSortie[1]}/${dateSortie[0]}`;
        } else if (! field.id.includes('checkbox')) {
             champs[field.id] = field.value;
        }
    }
    localStorage.setItem("profil",JSON.stringify(champs));
    return champs;
}
// Sauvegarder Profile 
// Générer attestation
$('#generer-attestation').addEventListener('click', async (event) => {
    event.preventDefault();

    profil = saveProfil();
    
    const reasons = getMotifs();
    const pdfBlob = await generatePdf(profil, reasons);

    const creationInstant = new Date();
    const creationDate = creationInstant.toLocaleDateString('fr-CA');
    const creationHour = creationInstant
          .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          .replace(':', '-');
    downloadBlob(pdfBlob, `attestation-${creationDate}_${creationHour}.pdf`);

});

if (localStorage.getItem('profil')) {
    profil = JSON.parse(localStorage.getItem('profil'));
    for (const champ of Object.keys(profil)) {
        $(`#${champ}`).value = profil[champ];
    }
}
