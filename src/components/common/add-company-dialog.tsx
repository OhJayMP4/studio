'use client';

import { useState, useRef } from 'react';
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
import { useFirestore, useUser, useStorage } from '@/firebase';
import { useSelectedWorkspace } from '@/app/(main)/layout';
import { addDoc, collection, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Upload, X, Building } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

const formSchema = z.object({
  name: z.string().min(1, 'Company name is required.'),
  description: z.string().min(1, 'Description is required.'),
  yearlyTurnoverTarget: z.preprocess(
    (a) => (a === '' ? undefined : parseFloat(String(a))),
    z.number().positive().optional()
  ),
});

type FormValues = z.infer<typeof formSchema>;

export function AddCompanyDialog({ children }: { children?: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { selectedWorkspace } = useSelectedWorkspace();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

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

  const handleCreateCompany = async (data: FormValues) => {
    if (!selectedWorkspace || !user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must select a workspace and be logged in to add a company.',
      });
      return;
    }

    try {
      const companiesCollection = collection(firestore, 'workspaces', selectedWorkspace.id, 'companies');
      const companyDoc = await addDoc(companiesCollection, {
        name: data.name,
        description: data.description,
        yearlyTurnoverTarget: data.yearlyTurnoverTarget || null,
        workspaceId: selectedWorkspace.id,
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
      });

      if (logoFile && storage) {
        const logoRef = ref(storage, `workspaces/${selectedWorkspace.id}/companies/${companyDoc.id}/logo`);
        
        const snapshot = await uploadBytes(logoRef, logoFile, {
            contentType: logoFile.type || 'image/png',
        });

        const logoUrl = await getDownloadURL(snapshot.ref);
        await updateDoc(doc(firestore, companyDoc.ref.path), { logoUrl });
      }
      
      toast({
        title: 'Company Created',
        description: `The "${data.name}" company has been successfully created.`,
      });
      reset();
      handleRemoveLogo();
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error creating company:', error);
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: error.message || 'Could not create the company.',
      });
    }
  };
  
  const trigger = children ? (
    <DialogTrigger asChild onClick={() => setIsOpen(true)}>{children}</DialogTrigger>
  ) : (
    <DialogTrigger asChild onClick={() => setIsOpen(true)}>
      <Button>
        <PlusCircle className="mr-2 h-4 w-4" />
        Add Company
      </Button>
    </DialogTrigger>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger}
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(handleCreateCompany)}>
          <DialogHeader>
            <DialogTitle>Add a new company</DialogTitle>
            <DialogDescription>
              Fill in the details for the new company in your workspace.
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
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Recommended: Square PNG/JPG</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Company Name</Label>
              <Input
                id="name"
                placeholder="e.g. Acme Inc."
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What does this company do?"
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearlyTurnoverTarget">Yearly Turnover Target (ZAR)</Label>
              <Input
                id="yearlyTurnoverTarget"
                type="number"
                placeholder="e.g. 1000000"
                {...register('yearlyTurnoverTarget')}
              />
              {errors.yearlyTurnoverTarget && (
                <p className="text-sm text-destructive mt-1">{errors.yearlyTurnoverTarget.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Company'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
