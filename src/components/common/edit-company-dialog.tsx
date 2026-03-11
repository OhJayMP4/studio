'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore, useStorage } from '@/firebase';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Upload, X, Building } from 'lucide-react';
import type { Company } from '@/lib/types';

const formSchema = z.object({
  name: z.string().min(1, 'Company name is required.'),
  description: z.string().min(1, 'Description is required.'),
  yearlyTurnoverTarget: z.preprocess(
    (a) => (a === '' ? undefined : parseFloat(String(a))),
    z.number().positive().optional()
  ),
});

type FormValues = z.infer<typeof formSchema>;

interface EditCompanyDialogProps {
  company: Company;
  children: React.ReactNode;
}

export function EditCompanyDialog({ company, children }: EditCompanyDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(company.logoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firestore = useFirestore();
  const storage = useStorage();
  const { selectedWorkspace } = useSelectedWorkspace();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: company.name,
      description: company.description,
      yearlyTurnoverTarget: company.yearlyTurnoverTarget,
    }
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        name: company.name,
        description: company.description,
        yearlyTurnoverTarget: company.yearlyTurnoverTarget,
      });
      setLogoPreview(company.logoUrl || null);
      setLogoFile(null);
    }
  }, [isOpen, company, reset]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'File too large', description: 'Please select an image smaller than 2MB.' });
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpdateCompany = async (data: FormValues) => {
    if (!selectedWorkspace) return;

    try {
      let finalLogoUrl = company.logoUrl || null;

      if (logoPreview === null) {
          finalLogoUrl = null;
      } else if (logoFile && storage) {
          const logoRef = ref(storage, `workspaces/${selectedWorkspace.id}/companies/${company.id}/logo`);
          const snapshot = await uploadBytes(logoRef, logoFile, {
              contentType: logoFile.type || 'image/png'
          });
          finalLogoUrl = await getDownloadURL(snapshot.ref);
      }

      const companyRef = doc(firestore, 'workspaces', selectedWorkspace.id, 'companies', company.id);
      await updateDoc(companyRef, {
        ...data,
        logoUrl: finalLogoUrl,
        yearlyTurnoverTarget: data.yearlyTurnoverTarget || null,
        updatedAt: serverTimestamp(),
      });
      
      toast({
        title: 'Company Updated',
        description: `The "${data.name}" company has been successfully updated.`,
      });
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error updating company:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not update the company.',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild onClick={() => setIsOpen(true)}>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(handleUpdateCompany)}>
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>
              Update the details for the "{company.name}" company.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col items-center gap-4 mb-4">
                <Label>Company Logo</Label>
                <div className="relative group">
                    <Avatar className="h-24 w-24 border-2 border-muted">
                        <AvatarImage src={logoPreview || undefined} className="object-cover" />
                        <AvatarFallback className="bg-muted text-muted-foreground">
                            <Building className="h-10 w-10" />
                        </AvatarFallback>
                    </Avatar>
                    {logoPreview ? (
                        <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-sm hover:bg-destructive/90 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full backdrop-blur-sm"
                        >
                            <Upload className="h-6 w-6" />
                        </button>
                    )}
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Company Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register('description')} />
              {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearlyTurnoverTarget">Yearly Turnover Target (ZAR)</Label>
              <Input id="yearlyTurnoverTarget" type="number" {...register('yearlyTurnoverTarget')} />
              {errors.yearlyTurnoverTarget && <p className="text-sm text-destructive mt-1">{errors.yearlyTurnoverTarget.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
