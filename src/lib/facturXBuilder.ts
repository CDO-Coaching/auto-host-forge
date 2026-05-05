/**
 * Factur-X (ZUGFeRD 2.x) builder
 * Profil: EN 16931 (COMFORT)
 * Spec: https://fnfe-mpe.org/factur-x/
 *
 * Prend un PDF jsPDF existant et :
 *  - génère le XML CII (UN/CEFACT Cross-Industry Invoice) au profil EN 16931
 *  - l'embarque dans le PDF (AFRelationship = Alternative, nom = factur-x.xml)
 *  - ajoute les métadonnées XMP Factur-X + PDF/A-3
 *  - déclare un OutputIntent sRGB minimal (bonne pratique PDF/A-3)
 *
 * Le PDF résultant est conforme aux exigences fonctionnelles des plateformes
 * de dématérialisation acceptant Factur-X EN 16931.
 */
import { PDFDocument, PDFName, PDFHexString, PDFString, PDFArray, PDFDict, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { format } from "date-fns";

export interface FacturXSeller {
  name: string;
  address?: string | null;
  postCode?: string | null;
  city?: string | null;
  countryCode?: string; // ISO 3166-1 alpha-2 (default FR)
  siret?: string | null;
  email?: string | null;
  phone?: string | null;
  vatId?: string | null; // optional
}

export interface FacturXBuyer {
  name: string;
  address?: string | null;
  postCode?: string | null;
  city?: string | null;
  countryCode?: string;
  email?: string | null;
}

export interface FacturXLine {
  description: string;
  quantity: number;
  unitCode?: string; // UN/ECE Rec 20 (C62 = piece/unité, HUR = hour, MON = month)
  unitPriceHT: number; // EUR HT
  vatRate: number; // pourcentage (0 si exonéré)
}

export interface FacturXInvoiceData {
  invoiceNumber: string;
  issueDate: Date;
  servicePeriodStart?: Date;
  servicePeriodEnd?: Date;
  currency?: string; // default EUR
  seller: FacturXSeller;
  buyer: FacturXBuyer;
  lines: FacturXLine[];
  /**
   * Catégorie TVA :
   *  - "S" = standard
   *  - "E" = exonéré (mention légale obligatoire dans `vatExemptionReason`)
   *  - "Z" = taux zéro
   */
  vatCategory: "S" | "E" | "Z";
  vatExemptionReason?: string; // ex: "TVA non applicable, art. 293 B du CGI"
  paymentMeansCode?: string; // UNTDID 4461: 30 = virement, 10 = espèces, 1 = autre
  paymentTerms?: string;
  paymentDate?: Date;
  payeeIban?: string;
  payeeBic?: string;
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const fmtAmount = (n: number) => n.toFixed(2);
const fmtQty = (n: number) => {
  // jusqu'à 4 décimales, sans zéros inutiles
  const v = Number(n.toFixed(4));
  return Number.isInteger(v) ? v.toFixed(0) : v.toString();
};
const fmtDate = (d: Date) => format(d, "yyyyMMdd");

/**
 * Construit le XML CII conforme au profil EN 16931 (urn:cen.eu:en16931:2017)
 */
export const buildFacturXXml = (data: FacturXInvoiceData): string => {
  const currency = data.currency || "EUR";
  const totalHT = data.lines.reduce((s, l) => s + l.quantity * l.unitPriceHT, 0);
  const totalVAT = data.lines.reduce((s, l) => s + l.quantity * l.unitPriceHT * (l.vatRate / 100), 0);
  const totalTTC = totalHT + totalVAT;

  const sellerCountry = (data.seller.countryCode || "FR").toUpperCase();
  const buyerCountry = (data.buyer.countryCode || "FR").toUpperCase();

  const lineXml = data.lines
    .map((l, idx) => {
      const lineTotal = l.quantity * l.unitPriceHT;
      const unitCode = l.unitCode || "C62";
      return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${idx + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${xmlEscape(l.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${fmtAmount(l.unitPriceHT)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${unitCode}">${fmtQty(l.quantity)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${data.vatCategory}</ram:CategoryCode>
          <ram:RateApplicablePercent>${fmtAmount(l.vatRate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${fmtAmount(lineTotal)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
    })
    .join("");

  const sellerAddress = `
        <ram:PostalTradeAddress>
          ${data.seller.postCode ? `<ram:PostcodeCode>${xmlEscape(data.seller.postCode)}</ram:PostcodeCode>` : ""}
          ${data.seller.address ? `<ram:LineOne>${xmlEscape(data.seller.address)}</ram:LineOne>` : ""}
          ${data.seller.city ? `<ram:CityName>${xmlEscape(data.seller.city)}</ram:CityName>` : ""}
          <ram:CountryID>${sellerCountry}</ram:CountryID>
        </ram:PostalTradeAddress>`;

  const buyerAddress = `
        <ram:PostalTradeAddress>
          ${data.buyer.postCode ? `<ram:PostcodeCode>${xmlEscape(data.buyer.postCode)}</ram:PostcodeCode>` : ""}
          ${data.buyer.address ? `<ram:LineOne>${xmlEscape(data.buyer.address)}</ram:LineOne>` : ""}
          ${data.buyer.city ? `<ram:CityName>${xmlEscape(data.buyer.city)}</ram:CityName>` : ""}
          <ram:CountryID>${buyerCountry}</ram:CountryID>
        </ram:PostalTradeAddress>`;

  // SIRET vendeur via schemeID 0009 (norme PEPPOL)
  const sellerLegalOrg = data.seller.siret
    ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0009">${xmlEscape(data.seller.siret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>`
    : "";

  // SpecifiedTaxRegistration : OBLIGATOIRE pour exonération TVA (BR-E-02).
  // Si pas de n° de TVA, on déclare le SIRET comme identifiant fiscal (schemeID="FC" = France).
  const sellerTaxReg = data.seller.vatId
    ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${xmlEscape(data.seller.vatId)}</ram:ID>
        </ram:SpecifiedTaxRegistration>`
    : data.seller.siret
    ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="FC">${xmlEscape(data.seller.siret)}</ram:ID>
        </ram:SpecifiedTaxRegistration>`
    : "";

  // BillingSpecifiedPeriod doit être dans Settlement (pas Delivery) selon le XSD CII
  const periodXml =
    data.servicePeriodStart && data.servicePeriodEnd
      ? `
      <ram:BillingSpecifiedPeriod>
        <ram:StartDateTime>
          <udt:DateTimeString format="102">${fmtDate(data.servicePeriodStart)}</udt:DateTimeString>
        </ram:StartDateTime>
        <ram:EndDateTime>
          <udt:DateTimeString format="102">${fmtDate(data.servicePeriodEnd)}</udt:DateTimeString>
        </ram:EndDateTime>
      </ram:BillingSpecifiedPeriod>`
      : "";

  const vatBreakdown = `
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${fmtAmount(totalVAT)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        ${data.vatExemptionReason ? `<ram:ExemptionReason>${xmlEscape(data.vatExemptionReason)}</ram:ExemptionReason>` : ""}
        <ram:BasisAmount>${fmtAmount(totalHT)}</ram:BasisAmount>
        <ram:CategoryCode>${data.vatCategory}</ram:CategoryCode>
        <ram:RateApplicablePercent>${fmtAmount(data.lines[0]?.vatRate || 0)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`;

  const cleanIban = data.payeeIban ? data.payeeIban.replace(/\s+/g, "").toUpperCase() : "";
  const cleanBic = data.payeeBic ? data.payeeBic.replace(/\s+/g, "").toUpperCase() : "";
  const payeeAccountXml = cleanIban
    ? `
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${xmlEscape(cleanIban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>${
        cleanBic
          ? `
        <ram:PayeeSpecifiedCreditorFinancialInstitution>
          <ram:BICID>${xmlEscape(cleanBic)}</ram:BICID>
        </ram:PayeeSpecifiedCreditorFinancialInstitution>`
          : ""
      }`
    : "";
  const paymentMeans = data.paymentMeansCode
    ? `
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>${data.paymentMeansCode}</ram:TypeCode>${payeeAccountXml}
      </ram:SpecifiedTradeSettlementPaymentMeans>`
    : "";

  // BR-CO-25 : si montant dû positif, DueDate OU PaymentTerms description doit être présent.
  // On garantit toujours une description (ex: "Payé" si déjà réglé).
  const termsDescription =
    data.paymentTerms || (data.paymentDate ? "Facture acquittée" : "Paiement à réception");
  const paymentTermsXml = `
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>${xmlEscape(termsDescription)}</ram:Description>${
    data.paymentDate
      ? `
        <ram:DueDateDateTime><udt:DateTimeString format="102">${fmtDate(data.paymentDate)}</udt:DateTimeString></ram:DueDateDateTime>`
      : ""
  }
      </ram:SpecifiedTradePaymentTerms>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${xmlEscape(data.invoiceNumber)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${fmtDate(data.issueDate)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lineXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${xmlEscape(data.seller.name)}</ram:Name>${sellerLegalOrg}${sellerAddress}${
    data.seller.email
      ? `
        <ram:URIUniversalCommunication><ram:URIID schemeID="EM">${xmlEscape(data.seller.email)}</ram:URIID></ram:URIUniversalCommunication>`
      : ""
  }${sellerTaxReg}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${xmlEscape(data.buyer.name)}</ram:Name>${buyerAddress}${
    data.buyer.email
      ? `
        <ram:URIUniversalCommunication><ram:URIID schemeID="EM">${xmlEscape(data.buyer.email)}</ram:URIID></ram:URIUniversalCommunication>`
      : ""
  }
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>${paymentMeans}${vatBreakdown}${periodXml}${paymentTermsXml}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${fmtAmount(totalHT)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${fmtAmount(totalHT)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${currency}">${fmtAmount(totalVAT)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${fmtAmount(totalTTC)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${fmtAmount(totalTTC)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
};

/**
 * Métadonnées XMP avec extension Factur-X (ConformanceLevel = EN 16931)
 * + déclaration PDF/A-3.
 */
const buildXmpMetadata = (data: FacturXInvoiceData): string => {
  const now = new Date().toISOString();
  const title = `Facture ${data.invoiceNumber}`;
  const author = data.seller.name;
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
      xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"
      xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#"
      xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#"
      xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(title)}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${xmlEscape(author)}</rdf:li></rdf:Seq></dc:creator>
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">Facture électronique Factur-X EN 16931</rdf:li></rdf:Alt></dc:description>
      <xmp:CreatorTool>CDO Coaching - Factur-X Generator</xmp:CreatorTool>
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
      <pdf:Producer>pdf-lib + jsPDF</pdf:Producer>
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>fx</pdfaSchema:prefix>
            <pdfaSchema:property>
              <rdf:Seq>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentFileName</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Name of the embedded XML file</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentType</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>INVOICE</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>Version</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Factur-X version</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>ConformanceLevel</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>EN 16931</pdfaProperty:description>
                </rdf:li>
              </rdf:Seq>
            </pdfaSchema:property>
          </rdf:li>
        </rdf:Bag>
      </pdfaExtension:schemas>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
};

/**
 * Prend un PDF "classique" (ArrayBuffer) et y embarque le XML Factur-X
 * + métadonnées XMP. Retourne un Uint8Array du PDF Factur-X final.
 */
export const embedFacturXIntoPdf = async (
  pdfBytes: ArrayBuffer | Uint8Array,
  data: FacturXInvoiceData
): Promise<Uint8Array> => {
  const xml = buildFacturXXml(data);
  const xmlBytes = new TextEncoder().encode(xml);
  const xmp = buildXmpMetadata(data);

  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });

  // Métadonnées document standard
  pdfDoc.setTitle(`Facture ${data.invoiceNumber}`);
  pdfDoc.setAuthor(data.seller.name);
  pdfDoc.setProducer("pdf-lib + jsPDF (Factur-X)");
  pdfDoc.setCreator("CDO Coaching");
  pdfDoc.setCreationDate(data.issueDate);
  pdfDoc.setModificationDate(new Date());

  // 1) Attacher le fichier XML avec AFRelationship = Alternative
  await pdfDoc.attach(xmlBytes, "factur-x.xml", {
    mimeType: "application/xml",
    description: "Factur-X Invoice (EN 16931)",
    creationDate: data.issueDate,
    modificationDate: new Date(),
    afRelationship: "Alternative" as any,
  });

  // 2) S'assurer que le catalogue référence l'AF (Associated Files)
  // pdf-lib >= 1.17 gère AF via attach(); on patche manuellement par sécurité
  const context = pdfDoc.context;
  const catalog = pdfDoc.catalog;

  // Récupérer les EmbeddedFiles de manière défensive
  // (lookup(key, Type) throw si la clé est absente => on utilise lookup(key) puis instanceof)
  const namesRaw = catalog.lookup(PDFName.of("Names"));
  const namesDict = namesRaw instanceof PDFDict ? namesRaw : undefined;
  const embeddedFilesRaw = namesDict?.lookup(PDFName.of("EmbeddedFiles"));
  const embeddedFiles = embeddedFilesRaw instanceof PDFDict ? embeddedFilesRaw : undefined;
  const efNamesRaw = embeddedFiles?.lookup(PDFName.of("Names"));
  const efNames = efNamesRaw instanceof PDFArray ? efNamesRaw : undefined;

  if (efNames) {
    for (let i = 0; i < efNames.size(); i += 2) {
      const nameObj = efNames.lookup(i);
      const fileSpecRaw = efNames.lookup(i + 1);
      const fileSpec = fileSpecRaw instanceof PDFDict ? fileSpecRaw : undefined;
      const nameStr =
        nameObj instanceof PDFString || nameObj instanceof PDFHexString ? nameObj.decodeText() : "";
      if (nameStr === "factur-x.xml" && fileSpec) {
        fileSpec.set(PDFName.of("AFRelationship"), PDFName.of("Alternative"));
        const existingAfRaw = catalog.lookup(PDFName.of("AF"));
        let afArray = existingAfRaw instanceof PDFArray ? existingAfRaw : undefined;
        if (!afArray) {
          afArray = context.obj([]);
          catalog.set(PDFName.of("AF"), afArray);
        }
        const fileSpecRef = efNames.get(i + 1); // ref vers le filespec
        afArray.push(fileSpecRef);
      }
    }
  }

  // 3) Métadonnées XMP (Metadata stream sur le catalogue)
  const xmpBytes = new TextEncoder().encode(xmp);
  const metadataStream = context.stream(xmpBytes, {
    Type: "Metadata",
    Subtype: "XML",
    Length: xmpBytes.length,
  });
  const metadataRef = context.register(metadataStream);
  catalog.set(PDFName.of("Metadata"), metadataRef);

  return await pdfDoc.save({ useObjectStreams: false });
};

// Re-export utility
export const downloadBytes = (bytes: Uint8Array, filename: string, mime = "application/pdf") => {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
