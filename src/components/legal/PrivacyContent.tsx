export const PrivacyContent = () => (
  <>
    <section className="space-y-3 text-muted-foreground">
      <p>
        Split4me is a browser-first tool. Your bill data, people list, and preferences stay on the device you use, and are
        never transmitted to our servers.
      </p>
      <p>
        This policy explains what limited information we process, how it is used, and the options you have to control it.
        By using Split4me you accept the practices described below.
      </p>
    </section>

    <section className="space-y-2">
      <h2 className="text-xl font-semibold">1. Data we process</h2>
      <div className="space-y-2 text-muted-foreground">
        <p>
          Split4me does not require an account, and we do not collect names, emails, payment details, or analytics. The
          only data the app touches is:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Bill entries and people:</strong> Stored temporarily in your browser&apos;s localStorage so you can return
            to your draft split.
          </li>
          <li>
            <strong>Preferences:</strong> Country, currency, and rate presets saved in localStorage for convenience.
          </li>
          <li>
            <strong>File uploads:</strong> When you import a receipt image it is processed locally in the browser and is
            never uploaded to a server.
          </li>
        </ul>
      </div>
    </section>

    <section className="space-y-2">
      <h2 className="text-xl font-semibold">2. Local storage &amp; clearing data</h2>
      <p className="text-muted-foreground">
        You may clear the app&apos;s data at any time by using your browser&apos;s &quot;Clear Site Data&quot; controls or by deleting the
        Split4me entry inside localStorage/sessionStorage. Doing so removes every receipt, person, and preference saved in
        the app.
      </p>
    </section>

    <section className="space-y-2">
      <h2 className="text-xl font-semibold">3. Third-party services</h2>
      <div className="space-y-2 text-muted-foreground">
        <p>
          Split4me&apos;s interface uses open-source libraries (such as Next.js, Radix UI, html2canvas, and jsPDF). These
          libraries execute locally in your browser and do not transmit your data to their authors. We do not embed
          advertising, analytics scripts, or social tracking pixels.
        </p>
        <p>
          If you follow a link to an external site (for example when exporting a PDF or contacting support) their own
          privacy policies apply.
        </p>
      </div>
    </section>

    <section className="space-y-2">
      <h2 className="text-xl font-semibold">4. Security</h2>
      <p className="text-muted-foreground">
        Because Split4me runs entirely in your browser the security of your data depends on your device. Use a trusted
        computer, keep your operating system up to date, and avoid sharing the device if your split contains sensitive
        information.
      </p>
    </section>

    <section className="space-y-2">
      <h2 className="text-xl font-semibold">5. Your rights</h2>
      <p className="text-muted-foreground">
        You may export, edit, or delete your bill data at any time from within the app. Because we do not hold a copy of
        your information, we cannot restore anything you remove.
      </p>
    </section>

    <section className="space-y-2">
      <h2 className="text-xl font-semibold">6. Changes to this policy</h2>
      <p className="text-muted-foreground">
        We may update this policy when Split4me&apos;s functionality changes. Any updates will be posted on this page and take
        effect immediately upon publication.
      </p>
    </section>

    <section className="space-y-2">
      <h2 className="text-xl font-semibold">7. Questions</h2>
      <p className="text-muted-foreground">
        Split4me is an independent tool without a dedicated support inbox. For issues, check the FAQ or file feedback via
        the project repository.
      </p>
    </section>
  </>
);
