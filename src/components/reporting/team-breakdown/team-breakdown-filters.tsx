
'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Building2, FolderKanban } from 'lucide-react';
import type { Company, Project } from '@/lib/types';

interface TeamBreakdownFiltersProps {
  companies: Company[];
  projects: Project[];
  selectedCompanyId: string;
  setSelectedCompanyId: (id: string) => void;
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
}

export function TeamBreakdownFilters({
  companies,
  projects,
  selectedCompanyId,
  setSelectedCompanyId,
  selectedProjectId,
  setSelectedProjectId,
}: TeamBreakdownFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/20 border rounded-lg">
      <div className="space-y-1.5 flex-1">
        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Building2 className="h-3 w-3" /> Filter by Company
        </Label>
        <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="All Companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map(company => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5 flex-1">
        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <FolderKanban className="h-3 w-3" /> Filter by Project
        </Label>
        <Select 
          value={selectedProjectId} 
          onValueChange={setSelectedProjectId}
          disabled={selectedCompanyId === 'all'}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder={selectedCompanyId === 'all' ? "Select a company first" : "All Projects"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(project => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
