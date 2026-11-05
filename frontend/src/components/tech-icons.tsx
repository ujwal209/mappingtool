"use client";

import React from "react";

export function TechIcon({
  name,
  type,
  className = "w-6 h-6",
}: {
  name?: string;
  type?: string;
  className?: string;
}) {
  const norm = (name || type || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // Microsoft Fabric (OneLake)
  if (norm.includes("fabric") || norm.includes("onelake")) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7.5V16.5L12 22L22 16.5V7.5L12 2Z" fill="#0078D4" />
        <path d="M12 2L22 7.5L12 13L2 7.5L12 2Z" fill="#50E6FF" opacity="0.8" />
        <path d="M12 13V22L2 16.5V7.5L12 13Z" fill="#005A9E" />
        <path d="M12 13L22 7.5V16.5L12 22V13Z" fill="#0078D4" />
        <circle cx="12" cy="12" r="3" fill="#FFFFFF" />
      </svg>
    );
  }

  // Microsoft Dynamics 365 / Dataverse
  if (norm.includes("d365") || norm.includes("dynamics") || norm.includes("dataverse")) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4" fill="#002050" />
        <path d="M5 6H12C15.3137 6 18 8.68629 18 12C18 15.3137 15.3137 18 12 18H5V6Z" fill="#0078D4" />
        <path d="M9 9H12C13.6569 9 15 10.3431 15 12C15 13.6569 13.6569 15 12 15H9V9Z" fill="#50E6FF" />
      </svg>
    );
  }

  // Snowflake
  if (norm.includes("snowflake")) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4" fill="#29B5E8" />
        <path
          d="M12 4V20M4 12H20M6.5 6.5L17.5 17.5M17.5 6.5L6.5 17.5"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="2.5" fill="#FFFFFF" />
      </svg>
    );
  }

  // Databricks
  if (norm.includes("databricks")) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4" fill="#FF3621" />
        <path
          d="M12 4L4 8.5L12 13L20 8.5L12 4ZM4 11.5L12 16L20 11.5M4 15.5L12 20L20 15.5"
          stroke="#FFFFFF"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // PostgreSQL
  if (norm.includes("postgres") || norm.includes("postgresql")) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4" fill="#336791" />
        <path
          d="M12 5C8.134 5 5 7.686 5 11C5 13.5 6.8 15.6 9.4 16.5C9.3 17 9 18.5 7.5 19C9.5 19.2 11.5 18 12 17C12.5 17 13 17 13.5 17C17.642 17 21 14.314 21 11C21 7.686 17.642 5 12 5Z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  // Microsoft SQL Server / Azure SQL
  if (norm.includes("sqlserver") || norm.includes("mssql")) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4" fill="#CC292B" />
        <ellipse cx="12" cy="7" rx="7" ry="2.5" fill="#FFFFFF" />
        <path d="M5 7V17C5 18.38 8.13 19.5 12 19.5C15.87 19.5 19 18.38 19 17V7" stroke="#FFFFFF" strokeWidth="1.8" />
        <path d="M5 12C5 13.38 8.13 14.5 12 14.5C15.87 14.5 19 13.38 19 12" stroke="#FFFFFF" strokeWidth="1.8" />
      </svg>
    );
  }

  // Oracle
  if (norm.includes("oracle")) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4" fill="#F80000" />
        <rect x="5" y="7" width="14" height="10" rx="5" stroke="#FFFFFF" strokeWidth="2.5" fill="none" />
      </svg>
    );
  }

  // MongoDB Atlas
  if (norm.includes("mongo") || norm.includes("mongodb")) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4" fill="#001E2B" />
        <path
          d="M12 3C12 3 7 7.5 7 12C7 15.5 9 18.5 11.5 20.5V17C11.5 15 12 13 12 13C12 13 12.5 15 12.5 17V20.5C15 18.5 17 15.5 17 12C17 7.5 12 3 12 3Z"
          fill="#00ED64"
        />
      </svg>
    );
  }

  // Google BigQuery
  if (norm.includes("bigquery") || norm.includes("google")) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4" fill="#4285F4" />
        <circle cx="12" cy="12" r="6" stroke="#FFFFFF" strokeWidth="2" fill="none" />
        <path d="M16 16L20 20" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M10 12L12 14L15 9" stroke="#34A853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // Salesforce
  if (norm.includes("salesforce") || norm.includes("sfdc")) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4" fill="#00A1E0" />
        <path
          d="M10 7C11.5 5.5 13.8 5.5 15.2 6.8C16.2 6.2 17.5 6.4 18.2 7.2C19 8.2 19 9.5 18.5 10.5C19.5 11.2 20 12.5 19.5 13.8C19 15 17.8 15.8 16.5 15.8H8C6.3 15.8 5 14.5 5 12.8C5 11.4 6 10.2 7.2 10C7.2 8.5 8.5 7.2 10 7Z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  // Amazon S3
  if (norm.includes("s3") || norm.includes("aws")) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4" fill="#569A31" />
        <path d="M6 7L12 4L18 7V17L12 20L6 17V7Z" stroke="#FFFFFF" strokeWidth="1.8" fill="none" />
        <path d="M12 4V20M6 7L18 17M18 7L6 17" stroke="#FFFFFF" strokeWidth="1.2" />
      </svg>
    );
  }

  // Azure ADLS
  if (norm.includes("adls") || norm.includes("azure") || norm.includes("blob")) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4" fill="#0089D6" />
        <path d="M7 16L12 7L17 16H7Z" fill="#FFFFFF" />
      </svg>
    );
  }

  // REST API / Webhooks
  if (norm.includes("rest") || norm.includes("api") || norm.includes("http")) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4" fill="#0284C7" />
        <path d="M7 8L3 12L7 16M17 8L21 12L17 16M14 4L10 20" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // Spreadsheet / Excel / CSV / Sheet Upload
  if (norm.includes("sheet") || norm.includes("excel") || norm.includes("csv")) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4" fill="#107C41" />
        <path d="M5 5H19V19H5V5Z" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 10H19M5 15H19M11 5V19" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M8 8L10 12M10 8L8 12" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  // Default database icon
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#475569" />
      <ellipse cx="12" cy="7" rx="6" ry="2" fill="#94A3B8" />
      <path d="M6 7V17C6 18.1 8.7 19 12 19C15.3 19 18 18.1 18 17V7" stroke="#E2E8F0" strokeWidth="1.5" />
    </svg>
  );
}
