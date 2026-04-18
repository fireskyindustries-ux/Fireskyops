/**
 * © Leon Mouton – Firesky Industries 2024. All rights reserved.
 */
import { brand } from "@/brand.config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield, FileText, Lock, Info } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const year = new Date().getFullYear();
const copyrightYears = brand.copyrightYear === year
  ? `${brand.copyrightYear}`
  : `${brand.copyrightYear}–${year}`;

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-4 py-2">
        <img
          src={`${BASE}/${brand.logoFile}`}
          alt={brand.name}
          className="h-14 w-auto object-contain"
        />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{brand.name}</h1>
          <p className="text-sm text-muted-foreground">{brand.appTitle}</p>
        </div>
      </div>

      {/* Copyright */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            Copyright & Ownership
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p className="text-foreground font-medium text-base">
            © {brand.owner} – {brand.name} {copyrightYears}. All rights reserved.
          </p>
          <p>
            This software, including all associated source code, designs, data structures, workflows,
            and documentation, is the exclusive intellectual property of{" "}
            <span className="font-medium text-foreground">{brand.owner}</span> trading as{" "}
            <span className="font-medium text-foreground">{brand.name}</span>.
          </p>
          <p>
            Unauthorised copying, reproduction, modification, distribution, public display,
            or any other use of this software — in whole or in part — is strictly prohibited
            without prior written permission from the copyright holder.
          </p>
        </CardContent>
      </Card>

      {/* Terms of Use */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Terms of Use (EULA)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Access to and use of this platform is granted solely to authorised personnel of{" "}
            {brand.name} and its contracted parties. By accessing this system you agree to:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Use the platform only for legitimate business purposes on behalf of {brand.name}.</li>
            <li>Keep your login credentials confidential and not share access with unauthorised persons.</li>
            <li>Not attempt to reverse-engineer, decompile, copy, or reproduce any part of this software.</li>
            <li>Not use data accessed through this platform for purposes outside the scope of your role.</li>
            <li>Report any security vulnerabilities or data breaches to management immediately.</li>
          </ul>
          <p>
            Violation of these terms may result in immediate termination of access and legal action.
          </p>
        </CardContent>
      </Card>

      {/* Confidentiality / NDA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-primary" />
            Confidentiality
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            All information processed through this platform — including customer records, pricing,
            stock levels, business intelligence, and operational data — is strictly confidential
            and constitutes a trade secret of {brand.name}.
          </p>
          <p>
            Staff, contractors, and vendors with access to this system are bound by confidentiality
            obligations. Any disclosure of confidential information to third parties without
            authorisation is a breach of contract and may constitute a criminal offence.
          </p>
          <p className="font-medium text-foreground">
            If you are a contractor or vendor requiring an NDA, please contact management at{" "}
            <a href={`mailto:${brand.contact.email}`} className="text-primary underline">
              {brand.contact.email}
            </a>
            .
          </p>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-primary" />
            Application Info
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p><span className="font-medium text-foreground">Product:</span> {brand.name} {brand.appTitle}</p>
          <p><span className="font-medium text-foreground">Owner:</span> {brand.owner}</p>
          <p><span className="font-medium text-foreground">Contact:</span>{" "}
            <a href={`mailto:${brand.contact.email}`} className="text-primary underline">{brand.contact.email}</a>
          </p>
          <p><span className="font-medium text-foreground">Website:</span>{" "}
            <a href={`https://${brand.contact.website}`} target="_blank" rel="noopener noreferrer" className="text-primary underline">{brand.contact.website}</a>
          </p>
          <Separator className="my-3" />
          <p className="text-xs">
            © {brand.owner} – {brand.name} {copyrightYears}. All rights reserved.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
